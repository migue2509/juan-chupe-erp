from rest_framework.pagination import PageNumberPagination


class FlexPageNumberPagination(PageNumberPagination):
    """
    Paginador estándar pero que acepta ?page_size=N desde el cliente.
    Máximo 1000 por request para evitar consultas abusivas.
    """
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 1000
