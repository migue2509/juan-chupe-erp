from django.test import TestCase
from rest_framework.test import APIClient

from apps.attendance.models import AttendanceRecord
from apps.shifts.models import Shift
from apps.users.models import User


class ShiftLifecycleTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='admin',
            password='pass',
            full_name='Admin',
            role='admin',
        )
        self.client.force_authenticate(self.admin)

    def test_open_shift_does_not_create_duplicate_when_active_exists(self):
        active = Shift.objects.create(opened_by=self.admin)

        response = self.client.post('/api/shifts/open/', format='json')

        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Shift.objects.filter(status='open').count(), 1)
        self.assertEqual(response.data['shift']['id'], active.pk)

    def test_close_shift_closes_open_attendance_records(self):
        employee = User.objects.create_user(
            username='employee',
            password='pass',
            full_name='Employee',
            role='operative',
        )
        shift = Shift.objects.create(opened_by=self.admin)
        attendance = AttendanceRecord.objects.create(user=employee, shift=shift)

        response = self.client.post('/api/shifts/close/', format='json')

        self.assertEqual(response.status_code, 200, response.data)
        shift.refresh_from_db()
        attendance.refresh_from_db()
        self.assertEqual(shift.status, 'closed')
        self.assertEqual(shift.closed_by, self.admin)
        self.assertIsNotNone(attendance.check_out)
