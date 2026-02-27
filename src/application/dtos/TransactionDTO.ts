export interface TransactionDTO {
  id: string
  accountId: string
  accountName: string
  categoryId?: string
  categoryName?: string
  payeeId?: string
  payeeName?: string
  amount: number // cents
  date: string // YYYY-MM-DD
  notes?: string
  cleared: boolean
  reconciled: boolean
  isParent: boolean
  isChild: boolean
  parentId?: string
  subtransactions?: TransactionDTO[]
}
