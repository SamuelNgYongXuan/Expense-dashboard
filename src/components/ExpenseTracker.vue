<script>
import { supabase } from '@/supabase'

export default {
  name: 'ExpenseTracker',
  data() {
    return {
      selectedDate: new Date(),
      monthlyData: {},
      realtimeChannel: null  // Add this
      }
    },
  async mounted() {
    await this.fetchExpenses()
    this.setupRealtimeSubscription()
  },
  beforeUnmount() {
  if (this.realtimeChannel) {
    supabase.removeChannel(this.realtimeChannel)
  }
  },
  computed: {
    currentMonthKey() {
      const year = this.selectedDate.getFullYear();
      const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    },
    currentMonthDisplay() {
      return this.selectedDate.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
    },
    monthLabel() {
      return this.isCurrentMonth ? 'Total This Month' : `Total for ${this.currentMonthDisplay}`;
    },
    isCurrentMonth() {
      const now = new Date();
      return this.selectedDate.getFullYear() === now.getFullYear() &&
             this.selectedDate.getMonth() === now.getMonth();
    },
    currentData() {
      return this.monthlyData[this.currentMonthKey] || { 
        total: 0, 
        dailyTotal: 0, 
        categories: [] 
      };
    },
    monthlyTotal() {
      return this.currentData.total;
    },
    dailyTotal() {
      return this.currentData.dailyTotal || 0;
    },
    categories() {
      return this.currentData.categories || [];
    }
  },
  methods: {
    logout() {
      localStorage.removeItem('expense_tracker_token')
      localStorage.removeItem('expense_tracker_user_id')
      this.$router.push('/auth')
    },
    getCategoryIcon(category) {
      const icons = {
        'Food & Drinks': '🍔',
        'Transport': '🚗',
        'Entertainment': '🎬',
        'Shopping': '💡',
        'Apparals': '👔',
        'Healthcare': '💊',
        'Others': '💰'
      }
      return icons[category] || '📦'
    },
    previousMonth() {
      const newDate = new Date(this.selectedDate);
      newDate.setMonth(newDate.getMonth() - 1);
      this.selectedDate = newDate;
      this.fetchExpenses()
    },
    nextMonth() {
      if (!this.isCurrentMonth) {
        const newDate = new Date(this.selectedDate);
        newDate.setMonth(newDate.getMonth() + 1);
        this.selectedDate = newDate;
        this.fetchExpenses()
      }
    },
    async fetchExpenses() {
      // Get authenticated user's telegram_user_id
      const telegramUserId = localStorage.getItem('expense_tracker_user_id')
      
      if (!telegramUserId) {
        this.$router.push('/auth')
        return
      }

      // Get user from database
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_user_id', telegramUserId)
        .single()

      if (userError || !user) {
        console.error('User not found')
        localStorage.removeItem('expense_tracker_token')
        localStorage.removeItem('expense_tracker_user_id')
        this.$router.push('/auth')
        return
      }

      const year = this.selectedDate.getFullYear()
      const month = this.selectedDate.getMonth() + 1
      
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const endDate = new Date(year, month, 0)
      const endDateStr = `${year}-${String(month).padStart(2, '0')}-${endDate.getDate()}`

      const {data, error} = await supabase
        .from('expense')
        .select('*')
        .eq('user_id', user.id) // Filter by authenticated user
        .gte('created_at', startDate)
        .lte('created_at', endDateStr)
      
      if (error) throw error
      console.log(data)

      const total = data.reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
      
      // Calculate today's total (only for current month)
      const today = new Date().toISOString().split('T')[0]
      const dailyTotal = data
        .filter(expense => expense.created_at.startsWith(today))
        .reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
      
      // Group by category
      const categoryMap = {}
      data.forEach(expense => {
        const categoryName = expense.category
        
        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = {
            name: categoryName.slice(2),
            icon: this.getCategoryIcon(categoryName.slice(2).trim()),
            amount: 0
          }
        }
        
        categoryMap[categoryName].amount += parseFloat(expense.amount)
      })
      
      // Update monthlyData for this month
      this.monthlyData[this.currentMonthKey] = {
        total: total,
        dailyTotal: dailyTotal,
        categories: Object.values(categoryMap)
      }
      console.log(this.monthlyData)
    },

    setupRealtimeSubscription() {
    this.realtimeChannel = supabase
      .channel('expense-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', // Listens to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'expense'
        },
        (payload) => {
          console.log('New expense detected from Telegram bot!', payload)
          // Refresh current month data
          this.refreshCurrentMonth()
        }
      )
      .subscribe()
  },
  
  async refreshCurrentMonth() {
    // Clear cached data for current month
    delete this.monthlyData[this.currentMonthKey]
    // Fetch fresh data
    await this.fetchExpenses()
  }
  }
}
</script>

<template>
  <div class="dashboard">

    <div class="content-wrapper">
      <!-- Left Column: Stats -->
      <div class="stats-section">
        <div class="card">
          <h1 class="title">Expense Tracker</h1>
          
          <!-- Month Selector -->
          <div class="month-selector">
            <button class="nav-btn" @click="previousMonth">‹</button>
            <div class="month-display">{{ currentMonthDisplay }}</div>
            <button class="nav-btn" @click="nextMonth" :disabled="isCurrentMonth">›</button>
          </div>

          <!-- Monthly Total -->
          <div class="stat-card primary">
            <div class="stat-label">{{ monthLabel }}</div>
            <div class="stat-value">${{ monthlyTotal.toFixed(2) }}</div>
          </div>

          <!-- Daily Total (only show for current month) -->
          <div v-if="isCurrentMonth" class="stat-card secondary">
            <div class="stat-label">Today's Spending</div>
            <div class="stat-value">${{ dailyTotal.toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <!-- Right Column: Categories -->
      <div class="categories-section">
        <div class="card">
          <h2 class="section-title">Category Breakdown</h2>
          <div class="category-grid">
            <div 
              v-for="category in categories" 
              :key="category.name"
              class="category-item"
            >
              <div class="category-info">
                <div class="category-icon">{{ category.icon }}</div>
                <div class="category-details">
                  <div class="category-name">{{ category.name }}</div>
                  <div class="category-amount">${{ category.amount.toFixed(2) }}</div>
                </div>
              </div>
              <div class="category-bar">
                <div 
                  class="category-progress" 
                  :style="{ width: (category.amount / monthlyTotal * 100) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard {
  min-height: 100vh;
  height: 100vh;
  background: linear-gradient(135deg, #e0e7f1 0%, #f5d4d4 100%);
  padding: 1rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.content-wrapper {
  max-width: 600px;
  margin: 0 auto;
  height: 100%;
  overflow-y: auto;
  padding-bottom: 1rem;
}

.stats-section {
  margin-bottom: 1rem;
}

.categories-section {
  margin-bottom: 0;
}

.card {
  background: rgba(255, 255, 255, 0.95);
  border-radius: 20px;
  padding: 1.5rem;
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 1.5rem 0;
}

.month-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(102, 126, 234, 0.08);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.nav-btn {
  background: white;
  border: none;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.25rem;
  color: #667eea;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  flex-shrink: 0;
}

.nav-btn:hover:not(:disabled) {
  background: #667eea;
  color: white;
  transform: scale(1.05);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.month-display {
  flex: 1;
  text-align: center;
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
  min-width: 160px;
}

.stat-card {
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1rem;
}

.stat-card.primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-card.secondary {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-label {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: white;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 1.5rem 0;
}

.category-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.category-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: rgba(102, 126, 234, 0.03);
  padding: 1rem;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.category-item:hover {
  background: rgba(102, 126, 234, 0.08);
  transform: translateY(-2px);
}

.category-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.category-icon {
  font-size: 1.75rem;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  flex-shrink: 0;
}

.category-details {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.category-name {
  font-size: 0.9375rem;
  color: #4a5568;
  font-weight: 500;
}

.category-amount {
  font-size: 1.125rem;
  font-weight: 700;
  color: #2d3748;
  white-space: nowrap;
}

.category-bar {
  height: 6px;
  background: rgba(102, 126, 234, 0.15);
  border-radius: 3px;
  overflow: hidden;
}

.category-progress {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}


/* Desktop Layout - Two Column */
@media (min-width: 992px) {
  .dashboard {
    padding: 2rem;
  }

  .content-wrapper {
    max-width: none;
    display: grid;
    grid-template-columns: minmax(350px, 400px) 1fr;
    gap: 2rem;
    align-items: start;
    height: calc(100vh - 4rem);
    overflow: hidden;
    padding-bottom: 0;
  }

  .stats-section {
    margin-bottom: 0;
    height: 100%;
    overflow-y: auto;
  }

  .categories-section {
    margin-bottom: 0;
    height: 100%;
    overflow-y: auto;
  }

  .card {
    padding: 2rem;
  }

  .title {
    font-size: 2rem;
  }

  .stat-value {
    font-size: 3rem;
  }

  .section-title {
    font-size: 1.75rem;
  }

  .category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
  }
}

/* Medium Desktop - Single column categories */
@media (min-width: 992px) and (max-width: 1199px) {
  .content-wrapper {
    grid-template-columns: minmax(320px, 350px) 1fr;
    gap: 1.5rem;
  }

  .card {
    padding: 1.5rem;
  }

  .title {
    font-size: 1.5rem;
  }

  .stat-value {
    font-size: 2.5rem;
  }

  .section-title {
    font-size: 1.5rem;
  }

  .category-grid {
    grid-template-columns: 1fr;
  }
}

/* Extra Large Desktop */
@media (min-width: 1200px) {
  .content-wrapper {
    grid-template-columns: minmax(380px, 420px) 1fr;
    gap: 2rem;
  }

  .category-grid {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }
}

@media (min-width: 1400px) {
  .content-wrapper {
    max-width: 1600px;
    margin: 0 auto;
    grid-template-columns: 450px 1fr;
    gap: 2.5rem;
    height: calc(100vh - 4rem);
  }

  .card {
    padding: 2.5rem;
  }

  .stat-value {
    font-size: 3.5rem;
  }

  .category-grid {
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  }
}

/* Small Mobile */
@media (max-width: 576px) {
  .dashboard {
    padding: 0.75rem;
  }

  .card {
    padding: 1.25rem;
  }

  .title {
    font-size: 1.25rem;
  }

  .stat-value {
    font-size: 2rem;
  }

  .category-icon {
    width: 40px;
    height: 40px;
    font-size: 1.5rem;
  }

  .category-name {
    font-size: 0.875rem;
  }

  .category-amount {
    font-size: 1rem;
  }
}
</style>