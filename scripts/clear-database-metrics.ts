import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function clearDatabaseMetrics() {
  try {
    // Use raw query for better performance on large tables
    const result = await prisma.$executeRaw`TRUNCATE TABLE database_metrics;`
    console.log('Successfully cleared database metrics table')
    return result
  } catch (error) {
    console.error('Error clearing database metrics:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

clearDatabaseMetrics()
  .catch(error => {
    console.error('Failed to clear database metrics:', error)
    process.exit(1)
  }) 