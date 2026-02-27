export interface ApiResponse<T> {
  status: 'ok' | 'error'
  data: T
}

export interface BootstrapInfo {
  bootstrapped: boolean
  loginMethod: 'password' | 'header' | 'openid'
  availableLoginMethods: Array<{
    method: string
    enabled: boolean
  }>
  multiuser: boolean
}

export interface UserInfo {
  validated: boolean
  userName: string
  permission: 'owner' | 'admin' | 'user'
  userId: string
  displayName: string
  loginMethod: string
}

export interface EncryptionKey {
  id: string
  salt: string
  test: string
}

export interface FileInfo {
  deleted: boolean
  fileId: string
  groupId: string | null
  name: string
  encryptKeyId: string | null
  owner: string
}

export interface FileMetadata {
  name: string
  groupId?: string
  encryptMeta?: { keyId: string }
  format?: number
}
