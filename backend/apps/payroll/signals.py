# WorkLog se registra directamente en CustomTokenObtainPairSerializer.validate()
# porque Django's user_logged_in signal no se dispara con autenticación JWT.
