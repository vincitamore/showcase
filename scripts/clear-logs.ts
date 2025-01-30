import { prisma } from '@/lib/prisma'

async function clearLogs() {
  try {
    console.log('Deleting all logs from the database...')
    const { count } = await prisma.log.deleteMany({})
    console.log(`Successfully deleted ${count} logs`)
  } catch (error) {
    console.error('Error deleting logs:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearLogs() 