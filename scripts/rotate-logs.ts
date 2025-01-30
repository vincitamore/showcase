import { prisma } from '@/lib/prisma'

// Constants for log retention
const DB_LOGS_RETENTION_HOURS = 24 // Keep DB logs for 24 hours
const GENERAL_LOGS_RETENTION_DAYS = 7 // Keep general logs for 7 days

async function rotateLogs() {
  const now = new Date()
  
  try {
    console.log('Starting log rotation...')

    // Delete old database logs (older than 24 hours)
    const dbLogsDeleteDate = new Date(now.getTime() - (DB_LOGS_RETENTION_HOURS * 60 * 60 * 1000))
    const { count: deletedDbLogs } = await prisma.log.deleteMany({
      where: {
        timestamp: {
          lt: dbLogsDeleteDate
        },
        metadata: {
          path: ['metrics', 'labels', 'type'],
          equals: 'db_query'
        }
      }
    })
    
    console.log(`Deleted ${deletedDbLogs} database logs older than ${DB_LOGS_RETENTION_HOURS} hours`)

    // Delete old general logs (older than 7 days)
    const generalLogsDeleteDate = new Date(now.getTime() - (GENERAL_LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000))
    const { count: deletedGeneralLogs } = await prisma.log.deleteMany({
      where: {
        timestamp: {
          lt: generalLogsDeleteDate
        },
        metadata: {
          not: {
            path: ['metrics', 'labels', 'type'],
            equals: 'db_query'
          }
        }
      }
    })
    
    console.log(`Deleted ${deletedGeneralLogs} general logs older than ${GENERAL_LOGS_RETENTION_DAYS} days`)

    // Get current log counts
    const dbLogsCount = await prisma.log.count({
      where: {
        metadata: {
          path: ['metrics', 'labels', 'type'],
          equals: 'db_query'
        }
      }
    })

    const generalLogsCount = await prisma.log.count({
      where: {
        metadata: {
          not: {
            path: ['metrics', 'labels', 'type'],
            equals: 'db_query'
          }
        }
      }
    })

    console.log('Current log counts:')
    console.log(`- Database logs: ${dbLogsCount}`)
    console.log(`- General logs: ${generalLogsCount}`)
    console.log('Log rotation completed successfully')

  } catch (error) {
    console.error('Error during log rotation:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run if called directly
if (require.main === module) {
  rotateLogs()
}

export { rotateLogs } 