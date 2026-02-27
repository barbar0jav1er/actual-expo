export interface CategoryBudgetDTO {
  categoryId: string
  categoryName: string
  groupId: string
  groupName: string
  budgeted: number  // cents
  spent: number     // cents
  available: number // cents
  carryover: number // cents
  goal?: number     // cents
  goalProgress?: number // 0-1
  isOverBudget: boolean
}

export interface GroupBudgetDTO {
  groupId: string
  groupName: string
  budgeted: number  // cents
  spent: number     // cents
  available: number // cents
  categories: CategoryBudgetDTO[]
}

export interface MonthBudgetSummaryDTO {
  month: string     // YYYY-MM
  income: number    // cents
  toBeBudgeted: number  // cents
  totalBudgeted: number // cents
  totalSpent: number    // cents
  totalAvailable: number // cents
  overspent: number     // cents
  groups: GroupBudgetDTO[]
}
