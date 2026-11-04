import { deleteFileByCode } from '@/server/files/delete'
import { getTestFile } from '@/server/files/info'
import { listOwnedFiles } from '@/server/files/list'
import { uploadImageForUser } from '@/server/files/upload'

export const router = {
  files: {
    listOwned: listOwnedFiles,
    getTest: getTestFile,
    deleteByCode: deleteFileByCode,
    uploadImage: uploadImageForUser,
  },
}
