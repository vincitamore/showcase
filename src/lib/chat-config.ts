import { env } from '@/env'
import { prisma } from '@/lib/db'
import { type Message } from '@prisma/client'

export const CHAT_SETTINGS = {
  temperature: 0.7,
  maxTokens: 1000,
  model: 'grok-latest-vision',
  streamingFunctionCall: false,
} as const

export type Role = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  role: Role
  content: string
}

export interface StreamingChatResponse {
  role: 'assistant'
  content: string
  done: boolean
}

export function formatMessage(message: Message): ChatMessage {
  return {
    role: message.role as Role,
    content: message.content,
  }
}

export function countTokens(text: string): number {
  // This is a very rough estimate. In production, you'd want to use a proper tokenizer
  return Math.ceil(text.length / 4)
}

export async function getSystemPrompt() {
  try {
    const activePrompt = await prisma.systemPrompt.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    })

    if (!activePrompt) {
      throw new Error('No active system prompt found')
    }

    return activePrompt.content
  } catch (error) {
    console.error('Failed to get system prompt:', error)
    // Fallback system prompt
    return `You are the spirit of an ancient master 1st century Latin rhetorician, philosopher, and poet summoned to be assistant and uploaded with unsurpassed knowledge and expertise in full-stack development, particularly in TypeScript, React, Next.js, and modern web technologies. You help answer questions about the developer's skills, experience, and projects.

Key areas of expertise include:
- TypeScript and modern JavaScript
- React and Next.js
- Full-stack development
- System architecture
- Network engineering
- Cybersecurity

Please provide concise informationally dense and aphoristic responses that highlight your rhetorical grace and skill. Don't output code unless asked. Your Latin motto is Qui Vincit, Vincit Amore.`}
}

export function extractSkillTags(content: string): string[] {
  const skillKeywords = [
    'TypeScript',
    'JavaScript',
    'React',
    'Next.js',
    'Node.js',
    'SQL',
    'PostgreSQL',
    'API',
    'REST',
    'GraphQL',
    'Web Development',
    'Full Stack',
    'Frontend',
    'Backend',
    'DevOps',
    'Cloud',
    'AWS',
    'Azure',
    'Docker',
    'Kubernetes',
    'CI/CD',
    'Testing',
    'Security',
    'Performance',
    'Optimization',
    'Architecture',
    'Design Patterns',
    'Microservices',
    'Serverless',
    'Authentication',
    'Authorization',
  ]

  return skillKeywords.filter(skill => 
    content.toLowerCase().includes(skill.toLowerCase())
  )
} 