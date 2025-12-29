<template>
  <div class="auth-container">
    <div class="auth-card">
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Authenticating...</p>
      </div>
      
      <div v-else-if="error" class="error-state">
        <div class="error-icon">❌</div>
        <h2>Authentication Failed</h2>
        <p>{{ error }}</p>
        <p class="help-text">Please request a new login link from the Telegram bot by typing /login</p>
      </div>
      
      <div v-else class="success-state">
        <div class="success-icon">✅</div>
        <h2>Redirecting...</h2>
      </div>
    </div>
  </div>
</template>

<script>
import { supabase } from '@/supabase'

export default {
  name: 'AuthHandler',
  data() {
    return {
      loading: true,
      error: null
    }
  },
  async mounted() {
    await this.authenticateUser()
  },
  methods: {
    async authenticateUser() {
      try {
        // Get token from URL
        const urlParams = new URLSearchParams(window.location.search)
        const token = urlParams.get('token')
        console.log(token)
        if (!token) {
          this.error = 'No authentication token provided.'
          this.loading = false
          return
        }

        // Verify token with Supabase
        const { data, error } = await supabase
          .from('auth_tokens')
          .select('telegram_user_id, expires_at')
          .eq('token', token)
          .single()
        
        console.log(data)
        console.log(error)
        
        if (error || !data) {
          this.error = 'Invalid or expired token.'
          this.loading = false
          return
        }

        // Check if token is expired
        const expiresAt = new Date(data.expires_at)
        if (expiresAt < new Date()) {
          this.error = 'This login link has expired.'
          this.loading = false
          return
        }

        // Update last_used_at
        await supabase
          .from('auth_tokens')
          .update({ last_used_at: new Date().toISOString() })
          .eq('token', token)

        // Store token and user info in localStorage
        localStorage.setItem('expense_tracker_token', token)
        localStorage.setItem('expense_tracker_user_id', data.telegram_user_id)

        // Redirect to dashboard
        this.$router.push('/')
      } catch (err) {
        console.error('Authentication error:', err)
        this.error = 'An unexpected error occurred.'
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e0e7f1 0%, #f5d4d4 100%);
  padding: 1rem;
}

.auth-card {
  background: white;
  border-radius: 20px;
  padding: 3rem 2rem;
  max-width: 400px;
  width: 100%;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.loading-state, .error-state, .success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(102, 126, 234, 0.2);
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon, .success-icon {
  font-size: 4rem;
}

h2 {
  font-size: 1.5rem;
  color: #2d3748;
  margin: 0;
}

p {
  color: #4a5568;
  margin: 0.5rem 0;
}

.help-text {
  font-size: 0.875rem;
  color: #718096;
  margin-top: 1rem;
}

.error-state p {
  color: #e53e3e;
}
</style>