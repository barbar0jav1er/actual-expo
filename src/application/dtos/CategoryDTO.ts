export interface CategoryDTO {
  id: string
  name: string
  groupId: string
  groupName: string
  isIncome: boolean
  hidden: boolean
}

export interface CategoryGroupDTO {
  id: string
  name: string
  isIncome: boolean
  hidden: boolean
  categories: CategoryDTO[]
}
