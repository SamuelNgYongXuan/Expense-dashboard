<script>
import { supabase } from '@/supabase'

export default {
  name: 'ExpenseTracker',
  data() {
    return {
      selectedDate: new Date(),
      monthlyData: {},
      realtimeChannel: null,
      selectedCategory: null,
      allExpenses: []
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
    monthShort() {
      return this.selectedDate.toLocaleDateString('en-US', { month: 'short' });
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
    },
    categoryExpenses() {
      if (!this.selectedCategory) return [];
      return this.allExpenses.filter(expense => 
        expense.category === this.selectedCategory.fullName
      );
    }
  },
  methods: {
    getCategoryIcon(category) {
      return [...category][0] || '📦'
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
    handleCategoryClick(category) {
      this.selectedCategory = category;
    },
    handleBackToCategories() {
      this.selectedCategory = null;
    },
    formatDate(dateStr) {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    async fetchExpenses() {
      const telegramUserId = localStorage.getItem('expense_tracker_user_id')
      
      if (!telegramUserId) {
        this.$router.push('/auth')
        return
      }

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
        .eq('user_id', user.id)
        .gte('created_at', startDate)
        .lte('created_at', endDateStr)
      
      if (error) throw error
      
      this.allExpenses = data || []
      console.log(this.allExpenses)
      const total = data.reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
      
      const today = new Date().toISOString().split('T')[0]
      const dailyTotal = data
        .filter(expense => expense.created_at.startsWith(today))
        .reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
      
      const categoryMap = {}
      data.forEach(expense => {
        const categoryName = expense.category.trim()
        if (!categoryMap[categoryName]) {
          categoryMap[categoryName] = {
            name: categoryName.slice(2),
            icon: this.getCategoryIcon(categoryName),
            amount: 0,
            fullName: categoryName
          }
        }
        
        categoryMap[categoryName].amount += parseFloat(expense.amount)
      })
      
      this.monthlyData[this.currentMonthKey] = {
        total: total,
        dailyTotal: dailyTotal,
        categories: Object.values(categoryMap)
      }
    },

    setupRealtimeSubscription() {
      this.realtimeChannel = supabase
        .channel('expense-changes')
        .on(
          'postgres_changes',
          { 
            event: '*',
            schema: 'public',
            table: 'expense'
          },
          (payload) => {
            console.log('New expense detected from Telegram bot!', payload)
            this.refreshCurrentMonth()
          }
        )
        .subscribe()
    },
    
    async refreshCurrentMonth() {
      delete this.monthlyData[this.currentMonthKey]
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
        <div class="card1">
          <div class="header">
            <div>
              <div class="username">Expense Tracker</div>
            </div>
          </div>
          <!-- Month Selector -->
          <div class="month-selector">
            <button class="nav-btn" @click="previousMonth">‹</button>
            <div class="month-display">{{ currentMonthDisplay }}</div>
            <button class="nav-btn" @click="nextMonth" :disabled="isCurrentMonth">›</button>
          </div>

          <!-- Enhanced Outcome Card -->
          <div class="outcome-card-enhanced">
            <!-- Decorative circles -->
            <div class="deco-circle deco-circle-1"></div>
            <div class="deco-circle deco-circle-2"></div>
            <div class="deco-circle deco-circle-3"></div>

            <!-- Content -->
            <div class="outcome-content">
              <!-- Header with badge -->
              <div class="outcome-header">
                <span>Monthly Total</span>
                <div class="period-badge">{{ monthShort }}</div>
              </div>

              <!-- Amount -->
              <div class="outcome-amount">${{ monthlyTotal.toFixed(2) }}</div>

              <!-- Daily section (if current month) -->
              <div v-if="isCurrentMonth" class="daily-section">
                <div class="daily-inner">
                  <div>
                    <div class="daily-label">Today's Total</div>
                    <div class="daily-amount">${{ dailyTotal.toFixed(2) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Categories or Transactions -->
      <div class="categories-section">
        <div class="card">
          <template v-if="!selectedCategory">
            <h2 class="section-title">Categories</h2>
            <div class="category-list">
              <div 
                v-for="category in categories" 
                :key="category.name"
                class="category-item"
                @click="handleCategoryClick(category)"
              >
                <div class="category-info">
                  <div class="category-icon-wrapper">
                    <span class="category-icon">{{ category.icon }}</span>
                  </div>
                  <div class="category-details">
                    <div class="category-name">{{ category.name }}</div>
                    <div class="category-amount">${{ category.amount.toFixed(2) }}</div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="transaction-header">
              <button class="back-btn" @click="handleBackToCategories">
                ‹
              </button>
              <h2 class="section-title">{{ selectedCategory.name }}</h2>
            </div>
            
            <div class="transaction-detail-card">
              <div class="transaction-amount-large">${{ selectedCategory.amount.toFixed(2) }}</div>
              <div class="transaction-category">{{ selectedCategory.name }}</div>
              <div class="transaction-date">{{ currentMonthDisplay }}</div>
            </div>

            <div class="transactions-list">
              <div class="section-label">Transactions</div>
              <div 
                v-for="expense in categoryExpenses" 
                :key="expense.id"
                class="transaction-item"
              >
                <div class="transaction-info">
                  <div class="transaction-icon-wrapper">
                    <span class="transaction-icon">{{ selectedCategory.icon }}</span>
                  </div>
                  <div class="transaction-details-col">
                    <div class="transaction-desc">{{ expense.description || selectedCategory.name }}</div>
                    <div class="transaction-cat">{{ formatDate(expense.created_at) }}</div>
                  </div>
                </div>
                <div class="transaction-amount-small">${{ parseFloat(expense.amount).toFixed(2) }}</div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

.dashboard {
  min-height: 100vh;
  background: linear-gradient(135deg, #E8D5F2 0%, #F5E1E8 50%, #E8D5F2 100%);
  padding: 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

.card1 {
  background: white;
  border-radius: 24px;
  padding: 2rem;
  margin-bottom: -70px;
}

.card {
  background: white;
  border-radius: 24px;
  padding: 2rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.greeting {
  font-size: 1rem;
  color: #666;
  margin-bottom: 0.25rem;
}

.username {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a1a1a;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: #F5F5F5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: #EBEBEB;
}

/* New Enhanced Outcome Card Styles */
.outcome-card-enhanced {
  background: rgb(56, 1, 56);
  border-radius: 24px;
  padding: 2rem;
  color: white;
  position: relative;
  overflow: hidden;
  margin-bottom: 1.5rem;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
}

.deco-circle-1 {
  top: -40px;
  right: -40px;
  width: 150px;
  height: 150px;
  background: #4e2758;
}

.deco-circle-2 {
  top: 63px;
  right: 50px;
  width: 60px;
  height: 60px;
  background: #8F659A;
}

.deco-circle-3 {
  bottom: -30px;
  left: -30px;
  width: 120px;
  height: 120px;
  background: #4e2758;
}

.outcome-content {
  position: relative;
  z-index: 1;
}

.outcome-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  opacity: 0.9;
  font-weight: 500;
}

.period-badge {
  background: rgba(255, 255, 255, 0.25);
  padding: 0.4rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
}

.outcome-amount {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 2rem;
  letter-spacing: -0.02em;
}

.daily-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.daily-inner {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.daily-label {
  font-size: 0.85rem;
  opacity: 0.85;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

.daily-amount {
  font-size: 1.75rem;
  font-weight: 700;
}

.daily-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
}

.month-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #F8F8F8;
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
  font-size: 1.5rem;
  color: rgb(56, 1, 56);
  transition: all 0.2s;
  font-weight: 300;
}

.nav-btn:hover:not(:disabled) {
  background: rgb(56, 1, 56);
  color: white;
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.month-display {
  flex: 1;
  text-align: center;
  font-size: 0.95rem;
  font-weight: 600;
  color: #1a1a1a;
}

.section-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 1.5rem;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.category-item {
  background: #FAFAFA;
  border-radius: 16px;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.category-item:hover {
  background: #F0F0F0;
  transform: translateX(4px);
}

.category-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.category-icon-wrapper {
  width: 48px;
  height: 48px;
  background: white;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.category-icon {
  font-size: 1.5rem;
}

.category-details {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-name {
  font-size: 1rem;
  color: #1a1a1a;
  font-weight: 500;
}

.category-amount {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a1a1a;
}

.transaction-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.back-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: #F5F5F5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.5rem;
  color: rgb(56, 1, 56);
  transition: all 0.2s;
  font-weight: 300;
}

.back-btn:hover {
  background: #EBEBEB;
}

.transaction-detail-card {
  background: rgb(56, 1, 56);
  border-radius: 20px;
  padding: 2rem;
  color: white;
  margin-bottom: 1.5rem;
  text-align: center;
}

.transaction-amount-large {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.transaction-category {
  font-size: 1.1rem;
  opacity: 0.9;
  margin-bottom: 0.25rem;
}

.transaction-date {
  font-size: 0.9rem;
  opacity: 0.7;
}

.transactions-list {
  margin-top: 1.5rem;
}

.transaction-item {
  background: #FAFAFA;
  border-radius: 16px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.transaction-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.transaction-icon-wrapper {
  width: 48px;
  height: 48px;
  background: white;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.transaction-icon {
  font-size: 1.5rem;
}

.transaction-details-col {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.transaction-desc {
  font-size: 1rem;
  color: #1a1a1a;
  font-weight: 500;
}

.transaction-cat {
  font-size: 0.85rem;
  color: #999;
}

.transaction-amount-small {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1a1a1a;
}

@media (min-width: 768px) {
  .content-wrapper {
    grid-template-columns: 400px 1fr;
  }
}

@media (max-width: 767px) {
  .dashboard {
    padding: 1rem;
  }

  .card {
    padding: 1.5rem;
  }

  .outcome-amount {
    font-size: 2.5rem;
  }

  .daily-amount {
    font-size: 1.5rem;
  }

  .transaction-amount-large {
    font-size: 2.5rem;
  }
}
</style>