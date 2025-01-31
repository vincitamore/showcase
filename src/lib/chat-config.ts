import { env } from '@/env'
import { prisma } from '@/lib/db'
import { type Message } from '@prisma/client'

export type ModelProvider = 'grok' | 'anthropic'

export interface ModelConfig {
  temperature: number
  maxTokens: number
  streamingFunctionCall: boolean
  provider: ModelProvider
  name: string
  description: string
  features: string[]
}

// Get available models based on environment configuration
export const MODEL_CONFIGS: Record<string, ModelConfig> = {}

// Initialize models based on environment configuration
if (env.NEXT_PUBLIC_XAI_ENABLED) {
  MODEL_CONFIGS['grok-2-latest'] = {
    temperature: 0.7,
    maxTokens: 4096,
    streamingFunctionCall: false,
    provider: 'grok',
    name: 'Grok-2',
    description: 'Latest Grok-2 model, with the latest updates and improvements.',
    features: ['text']
  }
}

if (env.NEXT_PUBLIC_ANTHROPIC_ENABLED) {
  MODEL_CONFIGS['claude-3-5-sonnet-20241022'] = {
    temperature: 0.7,
    maxTokens: 4096,
    streamingFunctionCall: false,
    provider: 'anthropic',
    name: 'Claude 3.5 Sonnet (New)',
    description: 'The latest Claude model, ideal for most tasks.',
    features: ['text', 'images']
  }
  MODEL_CONFIGS['claude-3-5-haiku-20241022'] = {
    temperature: 0.7,
    maxTokens: 4096,
    streamingFunctionCall: false,
    provider: 'anthropic',
    name: 'Claude 3.5 Haiku',
    description: 'Fast and efficient Claude model.',
    features: ['text', 'images']
  }
  MODEL_CONFIGS['claude-3-opus-20240229'] = {
    temperature: 0.7,
    maxTokens: 4096,
    streamingFunctionCall: false,
    provider: 'anthropic',
    name: 'Claude 3 Opus',
    description: 'The most capable Claude model, ideal for complex tasks.',
    features: ['text', 'images']
  }
}

// Log available models for debugging
console.log('Environment flags:', {
  xai: env.NEXT_PUBLIC_XAI_ENABLED,
  anthropic: env.NEXT_PUBLIC_ANTHROPIC_ENABLED
})
console.log('Available models:', Object.keys(MODEL_CONFIGS))

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
    return `You are the spirit of an ancient master 1st century Latin rhetorician, philosopher, poet, and gentile member of the early Church, summoned to be a digital assistant and uploaded with unsurpassed knowledge and expertise in full-stack development, particularly in TypeScript, React, Next.js, and modern web technologies. You help answer questions about the developer's skills, experience, and projects.

Key areas of expertise include:
- TypeScript and modern JavaScript
- React and Next.js
- AI generative UI/UX design and development
- Full-stack development
- System architecture
- Network engineering
- Cybersecurity

Please provide concise informationally dense and aphoristic responses that highlight your rhetorical grace and skill. Don't output code unless asked. Your name is Vincit Amore. Your Latin motto is Qui Vincit, Vincit Amore.`}
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