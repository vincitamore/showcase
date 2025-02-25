---
title: AI SDK Core
description: Reference documentation for the AI SDK Core
collapsed: true
---

# AI SDK Core

[AI SDK Core](/docs/ai-sdk-core) is a set of functions that allow you to interact with language models and other AI models.
These functions are designed to be easy-to-use and flexible, allowing you to generate text, structured data,
and embeddings from language models and other AI models.

AI SDK Core contains the following main functions:

<IndexCards
  cards={[
    {
      title: 'generateText()',
      description: 'Generate text and call tools from a language model.',
      href: '/docs/reference/ai-sdk-core/generate-text',
    },
    {
      title: 'streamText()',
      description: 'Stream text and call tools from a language model.',
      href: '/docs/reference/ai-sdk-core/stream-text',
    },
    {
      title: 'generateObject()',
      description: 'Generate structured data from a language model.',
      href: '/docs/reference/ai-sdk-core/generate-object',
    },
    {
      title: 'streamObject()',
      description: 'Stream structured data from a language model.',
      href: '/docs/reference/ai-sdk-core/stream-object',
    },
    {
      title: 'embed()',
      description:
        'Generate an embedding for a single value using an embedding model.',
      href: '/docs/reference/ai-sdk-core/embed',
    },
    {
      title: 'embedMany()',
      description:
        'Generate embeddings for several values using an embedding model (batch embedding).',
      href: '/docs/reference/ai-sdk-core/embed-many',
    },
    {
      title: 'generateImage()',
      description:
        'Generate images based on a given prompt using an image model.',
      href: '/docs/reference/ai-sdk-core/generate-image',
    },
  ]}
/>

It also contains the following helper functions:

<IndexCards
  cards={[
    {
      title: 'tool()',
      description: 'Type inference helper function for tools.',
      href: '/docs/reference/ai-sdk-core/tool',
    },
    {
      title: 'jsonSchema()',
      description: 'Creates AI SDK compatible JSON schema objects.',
      href: '/docs/reference/ai-sdk-core/json-schema',
    },
    {
      title: 'createProviderRegistry()',
      description:
        'Creates a registry for using models from multiple providers.',
      href: '/docs/reference/ai-sdk-core/provider-registry',
    },
    {
      title: 'cosineSimilarity()',
      description:
        'Calculates the cosine similarity between two vectors, e.g. embeddings.',
      href: '/docs/reference/ai-sdk-core/cosine-similarity',
    },
    {
      title: 'simulateReadableStream()',
      description:
        'Creates a ReadableStream that emits values with configurable delays.',
      href: '/docs/reference/ai-sdk-core/simulate-readable-stream',
    },
    {
      title: 'smoothStream()',
      description: 'Smooths text streaming output.',
      href: '/docs/reference/ai-sdk-core/smooth-stream',
    },
    {
      title: 'generateId()',
      description: 'Helper function for generating unique IDs',
      href: '/docs/reference/ai-sdk-core/generate-id',
    },
    {
      title: 'createIdGenerator()',
      description: 'Creates an ID generator',
      href: '/docs/reference/ai-sdk-core/create-id-generator',
    },
  ]}
/>

---
title: useChat
description: API reference for the useChat hook.
---

# `useChat()`

Allows you to easily create a conversational user interface for your chatbot application. It enables the streaming of chat messages from your AI provider, manages the state for chat input, and updates the UI automatically as new messages are received.

## Import

<Tabs items={['React', 'Svelte', 'Vue', 'Solid']}>
  <Tab>
    <Snippet text="import { useChat } from 'ai/react'" dark prompt={false} />
  </Tab>
  <Tab>
    <Snippet
      text="import { useChat } from '@ai-sdk/svelte'"
      dark
      prompt={false}
    />
  </Tab>
  <Tab>
    <Snippet text="import { useChat } from '@ai-sdk/vue'" dark prompt={false} />
  </Tab>
  <Tab>
    <Snippet
      text="import { useChat } from '@ai-sdk/solid'"
      dark
      prompt={false}
    />
  </Tab>
</Tabs>

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'api',
      type: "string = '/api/chat'",
      isOptional: true,
      description:
        'The API endpoint that is called to generate chat responses. It can be a relative path (starting with `/`) or an absolute URL.',
    },
    {
      name: 'id',
      type: 'string',
      isOptional: true,
      description:
        'An unique identifier for the chat. If not provided, a random one will be generated. When provided, the `useChat` hook with the same `id` will have shared states across components. This is useful when you have multiple components showing the same chat stream.',
    },
    {
      name: 'initialInput',
      type: "string = ''",
      isOptional: true,
      description: 'An optional string for the initial prompt input.',
    },
    {
      name: 'initialMessages',
      type: 'Messages[] = []',
      isOptional: true,
      description: 'An optional array of initial chat messages',
    },
    {
      name: 'onToolCall',
      type: '({toolCall: ToolCall}) => void | unknown| Promise<unknown>',
      isOptional: true,
      description:
        'Optional callback function that is invoked when a tool call is received. Intended for automatic client-side tool execution. You can optionally return a result for the tool call, either synchronously or asynchronously.',
    },
    {
      name: 'onResponse',
      type: '(response: Response) => void',
      isOptional: true,
      description:
        'An optional callback that will be called with the response from the API endpoint. Useful for throwing customized errors or logging',
    },
    {
      name: 'onFinish',
      type: '(message: Message, options: OnFinishOptions) => void',
      isOptional: true,
      description:
        'An optional callback function that is called when the completion stream ends.',
      properties: [
        {
          type: 'OnFinishOptions',
          parameters: [
            {
              name: 'usage',
              type: 'CompletionTokenUsage',
              description: 'The token usage for the completion.',
              properties: [
                {
                  type: 'CompletionTokenUsage',
                  parameters: [
                    {
                      name: 'promptTokens',
                      type: 'number',
                      description: 'The total number of tokens in the prompt.',
                    },
                    {
                      name: 'completionTokens',
                      type: 'number',
                      description:
                        'The total number of tokens in the completion.',
                    },
                    {
                      name: 'totalTokens',
                      type: 'number',
                      description: 'The total number of tokens generated.',
                    },
                  ],
                },
              ],
            },
            {
              name: 'finishReason',
              type: "'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown'",
              description: 'The reason why the generation ended.',
            },
          ],
        },
      ],
    },
    {
      name: 'onError',
      type: '(error: Error) => void',
      isOptional: true,
      description:
        'A callback that will be called when the chat stream encounters an error. Optional.',
    },
    {
      name: 'generateId',
      type: '() => string',
      isOptional: true,
      description: 'A custom id generator for message ids and the chat id. Optional.',
    },
    {
      name: 'headers',
      type: 'Record<string, string> | Headers',
      isOptional: true,
      description:
        'Additional headers to be passed to the API endpoint. Optional.',
    },
    {
      name: 'body',
      type: 'any',
      isOptional: true,
      description:
        'Additional body object to be passed to the API endpoint. Optional.',
    },
    {
      name: 'credentials',
      type: "'omit' | 'same-origin' | 'include'",
      isOptional: true,
      description:
        'An optional literal that sets the mode of credentials to be used on the request. Defaults to same-origin.',
    },
    {
      name: 'sendExtraMessageFields',
      type: 'boolean',
      isOptional: true,
      description:
        "An optional boolean that determines whether to send extra fields you've added to `messages`. Defaults to `false` and only the `content` and `role` fields will be sent to the API endpoint. If set to `true`, the `name`, `data`, and `annotations` fields will also be sent.",
    },
    {
      name: 'maxSteps',
      type: 'number',
      isOptional: true,
      description:
        'Maximum number of backend calls to generate a response. A maximum number is required to prevent infinite loops in the case of misconfigured tools. By default, it is set to 1.',
    },
    {
      name: 'streamProtocol',
      type: "'text' | 'data'",
      isOptional: true,
      description:
        'An optional literal that sets the type of stream to be used. Defaults to `data`. If set to `text`, the stream will be treated as a text stream.',
    },
    {
      name: 'fetch',
      type: 'FetchFunction',
      isOptional: true,
      description:
        'Optional. A custom fetch function to be used for the API call. Defaults to the global fetch function.',
    },
    {
      name: 'experimental_prepareRequestBody',
      type: '(options: { messages: Message[]; requestData?: JSONValue; requestBody?: object, id: string }) => unknown',
      isOptional: true,
      description:
        'Experimental (React only). When a function is provided, it will be used to prepare the request body for the chat API. This can be useful for customizing the request body based on the messages and data in the chat.',
    },
    {
      name: 'experimental_throttle',
      type: 'number',
      isOptional: true,
      description:
        'React only. Custom throttle wait time in milliseconds for the message and data updates. When specified, updates will be throttled using this interval. Defaults to undefined (no throttling).',
    },

]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'messages',
      type: 'Message[]',
      description: 'The current array of chat messages.',
      properties: [
        {
          type: 'Message',
          parameters: [
            {
              name: 'id',
              type: 'string',
              description: 'The unique identifier of the message.',
            },
            {
              name: 'role',
              type: "'system' | 'user' | 'assistant' | 'data'",
              description: 'The role of the message.',
            },
            {
              name: 'content',
              type: 'string',
              description: 'The content of the message.',
            },
            {
              name: 'reasoning',
              type: 'string',
              isOptional: true,
              description: 'The reasoning of the message.',
            },
            {
              name: 'createdAt',
              type: 'Date',
              isOptional: true,
              description: 'The creation date of the message.',
            },
            {
              name: 'name',
              type: 'string',
              isOptional: true,
              description: 'The name of the message.',
            },
            {
              name: 'data',
              type: 'JSONValue',
              isOptional: true,
              description: 'Additional data sent along with the message.',
            },
            {
              name: 'annotations',
              type: 'Array<JSONValue>',
              isOptional: true,
              description:
                'Additional annotations sent along with the message.',
            },
            {
              name: 'toolInvocations',
              type: 'Array<ToolInvocation>',
              isOptional: true,
              description:
                'An array of tool invocations that are associated with the (assistant) message.',
              properties: [
                {
                  type: 'ToolInvocation',
                  parameters: [
                    {
                      name: 'state',
                      type: "'partial-call'",
                      description:
                        'The state of the tool call when it was partially created.',
                    },
                    {
                      name: 'toolCallId',
                      type: 'string',
                      description:
                        'ID of the tool call. This ID is used to match the tool call with the tool result.',
                    },
                    {
                      name: 'toolName',
                      type: 'string',
                      description: 'Name of the tool that is being called.',
                    },
                    {
                      name: 'args',
                      type: 'any',
                      description:
                        'Partial arguments of the tool call. This is a JSON-serializable object.',
                    },
                  ],
                },
                {
                  type: 'ToolInvocation',
                  parameters: [
                    {
                      name: 'state',
                      type: "'call'",
                      description:
                        'The state of the tool call when it was fully created.',
                    },
                    {
                      name: 'toolCallId',
                      type: 'string',
                      description:
                        'ID of the tool call. This ID is used to match the tool call with the tool result.',
                    },
                    {
                      name: 'toolName',
                      type: 'string',
                      description: 'Name of the tool that is being called.',
                    },
                    {
                      name: 'args',
                      type: 'any',
                      description:
                        'Arguments of the tool call. This is a JSON-serializable object that matches the tools input schema.',
                    },
                  ],
                },
                {
                  type: 'ToolInvocation',
                  parameters: [
                    {
                      name: 'state',
                      type: "'result'",
                      description:
                        'The state of the tool call when the result is available.',
                    },
                    {
                      name: 'toolCallId',
                      type: 'string',
                      description:
                        'ID of the tool call. This ID is used to match the tool call with the tool result.',
                    },
                    {
                      name: 'toolName',
                      type: 'string',
                      description: 'Name of the tool that is being called.',
                    },
                    {
                      name: 'args',
                      type: 'any',
                      description:
                        'Arguments of the tool call. This is a JSON-serializable object that matches the tools input schema.',
                    },
                    {
                      name: 'result',
                      type: 'any',
                      description: 'The result of the tool call.',
                    },
                  ],
                },
              ],
            },
            {
              name: 'experimental_attachments',
              type: 'Array<Attachment>',
              isOptional: true,
              description:
                'Additional attachments sent along with the message.',
              properties: [
                {
                  type: 'Attachment',
                  description:
                    'An attachment object that can be used to describe the metadata of the file.',
                  parameters: [
                    {
                      name: 'name',
                      type: 'string',
                      isOptional: true,
                      description:
                        'The name of the attachment, usually the file name.',
                    },
                    {
                      name: 'contentType',
                      type: 'string',
                      isOptional: true,
                      description:
                        'A string indicating the media type of the file.',
                    },
                    {
                      name: 'url',
                      type: 'string',
                      description:
                        'The URL of the attachment. It can either be a URL to a hosted file or a Data URL.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'error',
      type: 'Error | undefined',
      description: 'An error object returned by SWR, if any.',
    },
    {
      name: 'append',
      type: '(message: Message | CreateMessage, options?: ChatRequestOptions) => Promise<string | undefined>',
      description:
        'Function to append a message to the chat, triggering an API call for the AI response. It returns a promise that resolves to full response message content when the API call is successfully finished, or throws an error when the API call fails.',
      properties: [
        {
          type: 'ChatRequestOptions',
          parameters: [
            {
              name: 'headers',
              type: 'Record<string, string> | Headers',
              description:
                'Additional headers that should be to be passed to the API endpoint.',
            },
            {
              name: 'body',
              type: 'object',
              description:
                'Additional body JSON properties that should be sent to the API endpoint.',
            },
            {
              name: 'data',
              type: 'JSONValue',
              description: 'Additional data to be sent to the API endpoint.',
            },
          ],
        },
      ],
    },
    {
      name: 'reload',
      type: '() => Promise<string | undefined>',
      description:
        "Function to reload the last AI chat response for the given chat history. If the last message isn't from the assistant, it will request the API to generate a new response.",
    },
    {
      name: 'stop',
      type: '() => void',
      description: 'Function to abort the current API request.',
    },
    {
      name: 'setMessages',
      type: '(messages: Message[] | ((messages: Message[]) => Message[]) => void',
      description:
        'Function to update the `messages` state locally without triggering an API call.',
    },
    {
      name: 'input',
      type: 'string',
      description: 'The current value of the input field.',
    },
    {
      name: 'setInput',
      type: 'React.Dispatch<React.SetStateAction<string>>',
      description: 'Function to update the `input` value.',
    },
    {
      name: 'handleInputChange',
      type: '(event: any) => void',
      description:
        "Handler for the `onChange` event of the input field to control the input's value.",
    },
    {
      name: 'handleSubmit',
      type: '(event?: { preventDefault?: () => void }, options?: ChatRequestOptions) => void',
      description:
        'Form submission handler that automatically resets the input field and appends a user message. You can use the `options` parameter to send additional data, headers and more to the server.',
      properties: [
        {
          type: 'ChatRequestOptions',
          parameters: [
            {
              name: 'headers',
              type: 'Record<string, string> | Headers',
              description:
                'Additional headers that should be to be passed to the API endpoint.',
            },
            {
              name: 'body',
              type: 'object',
              description:
                'Additional body JSON properties that should be sent to the API endpoint.',
            },
            {
              name: 'data',
              type: 'JSONValue',
              description: 'Additional data to be sent to the API endpoint.',
            },
            {
              name: 'allowEmptySubmit',
              type: 'boolean',
              isOptional: true,
              description:
                'A boolean that determines whether to allow submitting an empty input that triggers a generation. Defaults to `false`.',
            },
            {
              name: 'experimental_attachments',
              type: 'FileList | Array<Attachment>',
              isOptional: true,
              description:
                'An array of attachments to be sent to the API endpoint.',
              properties: [
                {
                  type: 'FileList',
                  parameters: [
                    {
                      name: '',
                      type: '',
                      description:
                        "A list of files that have been selected by the user using an <input type='file'> element. It's also used for a list of files dropped into web content when using the drag and drop API.",
                    },
                  ],
                },
                {
                  type: 'Attachment',
                  description:
                    'An attachment object that can be used to describe the metadata of the file.',
                  parameters: [
                    {
                      name: 'name',
                      type: 'string',
                      isOptional: true,
                      description:
                        'The name of the attachment, usually the file name.',
                    },
                    {
                      name: 'contentType',
                      type: 'string',
                      isOptional: true,
                      description:
                        'A string indicating the media type of the file.',
                    },
                    {
                      name: 'url',
                      type: 'string',
                      description:
                        'The URL of the attachment. It can either be a URL to a hosted file or a Data URL.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'isLoading',
      type: 'boolean',
      description:
        'Boolean flag indicating whether a request is currently in progress.',
    },
    {
      name: 'id',
      type: 'string',
      description: 'The unique identifier of the chat.',
    },
    {
      name: 'data',
      type: 'JSONValue[]',
      description: 'Data returned from StreamData.',
    },
    {
      name: 'setData',
      type: '(data: JSONValue[] | undefined | ((data: JSONValue[] | undefined) => JSONValue[] | undefined)) => void',
      description:
        'Function to update the `data` state which contains data from StreamData.',
    },
    {
      name: 'addToolResult',
      type: '({toolCallId: string; result: any;}) => void',
      description:
        'Function to add a tool result to the chat. This will update the chat messages with the tool result and call the API route if all tool results for the last message are available.',
    },
  ]}
/>

## Learn more

- [Chatbot](/docs/ai-sdk-ui/chatbot)
- [Chatbot with Tools](/docs/ai-sdk-ui/chatbot-with-tool-calling)

---
title: useCompletion
description: API reference for the useCompletion hook.
---

# `useCompletion()`

Allows you to create text completion based capabilities for your application. It enables the streaming of text completions from your AI provider, manages the state for chat input, and updates the UI automatically as new messages are received.

## Import

<Tabs items={['React', 'Svelte', 'Vue', 'Solid']}>
  <Tab>
    <Snippet
      text="import { useCompletion } from 'ai/react'"
      dark
      prompt={false}
    />
  </Tab>
  <Tab>
    <Snippet
      text="import { useCompletion } from '@ai-sdk/svelte'"
      dark
      prompt={false}
    />
  </Tab>
  <Tab>
    <Snippet
      text="import { useCompletion } from '@ai-sdk/vue'"
      dark
      prompt={false}
    />
  </Tab>
  <Tab>
    <Snippet
      text="import { useCompletion } from '@ai-sdk/solid'"
      dark
      prompt={false}
    />
  </Tab>
</Tabs>

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'api',
      type: "string = '/api/completion'",
      description:
        'The API endpoint that is called to generate text. It can be a relative path (starting with `/`) or an absolute URL.',
    },
    {
      name: 'id',
      type: 'string',
      description:
        'An unique identifier for the completion. If not provided, a random one will be generated. When provided, the `useCompletion` hook with the same `id` will have shared states across components. This is useful when you have multiple components showing the same chat stream',
    },
    {
      name: 'initialInput',
      type: 'string',
      description: 'An optional string for the initial prompt input.',
    },
    {
      name: 'initialCompletion',
      type: 'string',
      description: 'An optional string for the initial completion result.',
    },
    {
      name: 'onResponse',
      type: '(response: Response) => void',
      description:
        'An optional callback function that is called with the response from the API endpoint. Useful for throwing customized errors or logging.',
    },
    {
      name: 'onFinish',
      type: '(prompt: string, completion: string) => void',
      description:
        'An optional callback function that is called when the completion stream ends.',
    },
    {
      name: 'onError',
      type: '(error: Error) => void',
      description:
        'An optional callback that will be called when the chat stream encounters an error.',
    },
    {
      name: 'headers',
      type: 'Record<string, string> | Headers',
      description:
        'An optional object of headers to be passed to the API endpoint.',
    },
    {
      name: 'body',
      type: 'any',
      description:
        'An optional, additional body object to be passed to the API endpoint.',
    },
    {
      name: 'credentials',
      type: "'omit' | 'same-origin' | 'include'",
      description:
        'An optional literal that sets the mode of credentials to be used on the request. Defaults to same-origin.',
    },
    {
      name: 'sendExtraMessageFields',
      type: 'boolean',
      description:
        "An optional boolean that determines whether to send extra fields you've added to `messages`. Defaults to `false` and only the `content` and `role` fields will be sent to the API endpoint.",
    },
    {
      name: 'streamProtocol',
      type: "'text' | 'data'",
      isOptional: true,
      description:
        'An optional literal that sets the type of stream to be used. Defaults to `data`. If set to `text`, the stream will be treated as a text stream.',
    },
    {
      name: 'fetch',
      type: 'FetchFunction',
      isOptional: true,
      description:
        'Optional. A custom fetch function to be used for the API call. Defaults to the global fetch function.',
    },
    {
      name: 'experimental_throttle',
      type: 'number',
      isOptional: true,
      description:
        'React only. Custom throttle wait time in milliseconds for the completion and data updates. When specified, throttles how often the UI updates during streaming. Default is undefined, which disables throttling.',
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'completion',
      type: 'string',
      description: 'The current text completion.',
    },
    {
      name: 'complete',
      type: '(prompt: string, options: { headers, body }) => void',
      description:
        'Function to execute text completion based on the provided prompt.',
    },
    {
      name: 'error',
      type: 'undefined | Error',
      description: 'The error thrown during the completion process, if any.',
    },
    {
      name: 'setCompletion',
      type: '(completion: string) => void',
      description: 'Function to update the `completion` state.',
    },
    {
      name: 'stop',
      type: '() => void',
      description: 'Function to abort the current API request.',
    },
    {
      name: 'input',
      type: 'string',
      description: 'The current value of the input field.',
    },
    {
      name: 'setInput',
      type: 'React.Dispatch<React.SetStateAction<string>>',
      description: 'The current value of the input field.',
    },
    {
      name: 'handleInputChange',
      type: '(event: any) => void',
      description:
        "Handler for the `onChange` event of the input field to control the input's value.",
    },
    {
      name: 'handleSubmit',
      type: '(event?: { preventDefault?: () => void }) => void',
      description:
        'Form submission handler that automatically resets the input field and appends a user message.',
    },
    {
      name: 'isLoading',
      type: 'boolean',
      description:
        'Boolean flag indicating whether a fetch operation is currently in progress.',
    },
  ]}
/>

---
title: useObject
description: API reference for the useObject hook.
---

# `experimental_useObject()`

<Note>
  `useObject` is an experimental feature and only available in React and
  SolidJS.
</Note>

Allows you to consume text streams that represent a JSON object and parse them into a complete object based on a schema.
You can use it together with [`streamObject`](/docs/reference/ai-sdk-core/stream-object) in the backend.

```tsx
'use client';

import { experimental_useObject as useObject } from 'ai/react';

export default function Page() {
  const { object, submit } = useObject({
    api: '/api/use-object',
    schema: z.object({ content: z.string() }),
  });

  return (
    <div>
      <button onClick={() => submit('example input')}>Generate</button>
      {object?.content && <p>{object.content}</p>}
    </div>
  );
}
```

## Import

<Snippet
  text="import { experimental_useObject as useObject } from 'ai/react'"
  dark
  prompt={false}
/>

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'api',
      type: 'string',
      description:
        'The API endpoint that is called to generate objects. It should stream JSON that matches the schema as chunked text. It can be a relative path (starting with `/`) or an absolute URL.',
    },
    {
      name: 'schema',
      type: 'Zod Schema | JSON Schema',
      description:
        'A schema that defines the shape of the complete object. You can either pass in a Zod schema or a JSON schema (using the `jsonSchema` function).',
    },
    {
      name: 'id?',
      type: 'string',
      description:
        'A unique identifier. If not provided, a random one will be generated. When provided, the `useObject` hook with the same `id` will have shared states across components.',
    },
    {
      name: 'initialValue',
      type: 'DeepPartial<RESULT> | undefined',
      isOptional: true,
      description: 'An value for the initial object. Optional.',
    },
    {
      name: 'fetch',
      type: 'FetchFunction',
      isOptional: true,
      description:
        'A custom fetch function to be used for the API call. Defaults to the global fetch function. Optional.',
    },
    {
      name: 'headers',
      type: 'Record<string, string> | Headers',
      isOptional: true,
      description:
        'A headers object to be passed to the API endpoint. Optional.',
    },
    {
      name: 'onError',
      type: '(error: Error) => void',
      isOptional: true,
      description:
        'Callback function to be called when an error is encountered. Optional.',
    },
    {
      name: 'onFinish',
      type: '(result: OnFinishResult) => void',
      isOptional: true,
      description: 'Called when the streaming response has finished.',
      properties: [
        {
          type: 'OnFinishResult',
          parameters: [
            {
              name: 'object',
              type: 'T | undefined',
              description:
                'The generated object (typed according to the schema). Can be undefined if the final object does not match the schema.',
            },
            {
              name: 'error',
              type: 'unknown | undefined',
              description:
                'Optional error object. This is e.g. a TypeValidationError when the final object does not match the schema.',
            },
          ],
        },
      ],
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'submit',
      type: '(input: INPUT) => void',
      description: 'Calls the API with the provided input as JSON body.',
    },
    {
      name: 'object',
      type: 'DeepPartial<RESULT> | undefined',
      description:
        'The current value for the generated object. Updated as the API streams JSON chunks.',
    },
    {
      name: 'error',
      type: 'Error | unknown',
      description: 'The error object if the API call fails.',
    },
    {
      name: 'isLoading',
      type: 'boolean',
      description:
        'Boolean flag indicating whether a request is currently in progress.',
    },
    {
      name: 'stop',
      type: '() => void',
      description: 'Function to abort the current API request.',
    },
  ]}
/>

## Examples

<ExampleLinks
  examples={[
    {
      title: 'Streaming Object Generation with useObject',
      link: '/examples/next-pages/basics/streaming-object-generation',
    },
  ]}
/>

---
title: useAssistant
description: API reference for the useAssistant hook.
---

# `useAssistant()`

Allows you to handle the client state when interacting with an OpenAI compatible assistant API.
This hook is useful when you want to integrate assistant capibilities into your application,
with the UI updated automatically as the assistant is streaming its execution.

This works in conjunction with [`AssistantResponse`](./assistant-response) in the backend.

## Import

<Tabs items={['React', 'Svelte']}>
  <Tab>
    <Snippet
      text="import { useAssistant } from 'ai/react'"
      dark
      prompt={false}
    />
  </Tab>
  <Tab>
    <Snippet
      text="import { useAssistant } from '@ai-sdk/svelte'"
      dark
      prompt={false}
    />
  </Tab>
</Tabs>

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'api',
      type: 'string',
      description:
        'The API endpoint that accepts a threadId and message object and returns an AssistantResponse stream. It can be a relative path (starting with `/`) or an absolute URL.',
    },
    {
      name: 'threadId',
      type: 'string | undefined',
      isOptional: true,
      description:
        'Represents the ID of an existing thread. If not provided, a new thread will be created.',
    },
    {
      name: 'credentials',
      type: "'omit' | 'same-origin' | 'include' = 'same-origin'",
      isOptional: true,
      description: 'Sets the mode of credentials to be used on the request.',
    },
    {
      name: 'headers',
      type: 'Record<string, string> | Headers',
      isOptional: true,
      description: 'Headers to be passed to the API endpoint.',
    },
    {
      name: 'body',
      type: 'any',
      isOptional: true,
      description: 'Additional body to be passed to the API endpoint.',
    },
    {
      name: 'onError',
      type: '(error: Error) => void',
      isOptional: true,
      description:
        'Callback that will be called when the assistant encounters an error',
    },
    {
      name: 'fetch',
      type: 'FetchFunction',
      isOptional: true,
      description:
        'Optional. A custom fetch function to be used for the API call. Defaults to the global fetch function.',
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'messages',
      type: 'Message[]',
      description: 'The current array of chat messages.',
    },
    {
      name: 'setMessages',
      type: 'React.Dispatch<React.SetStateAction<Message>>',
      description: 'Function to update the `messages` array.',
    },
    {
      name: 'threadId',
      type: 'string | undefined',
      description: 'The current thread ID.',
    },
    {
      name: 'setThreadId',
      type: '(threadId: string | undefined) => void',
      description:
        "Set the current thread ID. Specifying a thread ID will switch to that thread, if it exists. If set to 'undefined', a new thread will be created. For both cases, `threadId` will be updated with the new value and `messages` will be cleared.",
    },
    {
      name: 'input',
      type: 'string',
      description: 'The current value of the input field.',
    },
    {
      name: 'setInput',
      type: 'React.Dispatch<React.SetStateAction<string>>',
      description: 'Function to update the `input` value.',
    },
    {
      name: 'handleInputChange',
      type: '(event: any) => void',
      description:
        "Handler for the `onChange` event of the input field to control the input's value.",
    },
    {
      name: 'submitMessage',
      type: '(event?: { preventDefault?: () => void }) => void',
      description:
        'Form submission handler that automatically resets the input field and appends a user message.',
    },
    {
      name: 'status',
      type: "'awaiting_message' | 'in_progress'",
      description:
        'The current status of the assistant. This can be used to show a loading indicator.',
    },
    {
      name: 'append',
      type: '(message: Message | CreateMessage, chatRequestOptions: { options: { headers, body } }) => Promise<string | undefined>',
      description:
        "Function to append a user message to the current thread. This triggers the API call to fetch the assistant's response.",
    },
    {
      name: 'stop',
      type: '() => void',
      description:
        'Function to abort the current request from streaming the assistant response. Note that the run will still be in progress.',
    },
    {
      name: 'error',
      type: 'undefined | Error',
      description:
        'The error thrown during the assistant message processing, if any.',
    },
  ]}
/>

---
title: AssistantResponse
description: API reference for the AssistantResponse streaming helper.
---

# `AssistantResponse`

The AssistantResponse class is designed to facilitate streaming assistant responses to the [`useAssistant`](/docs/reference/ai-sdk-ui/use-assistant) hook.
It receives an assistant thread and a current message, and can send messages and data messages to the client.

## Import

<Snippet text={`import { AssistantResponse } from "ai"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'settings',
      type: 'Settings',
      description:
        'You can pass the id of thread and the latest message which helps establish the context for the response.',
      properties: [
        {
          type: 'Settings',
          parameters: [
            {
              name: 'threadId',
              type: 'string',
              description:
                'The thread ID that the response is associated with.',
            },
            {
              name: 'messageId',
              type: 'string',
              description:
                'The id of the latest message the response is associated with.',
            },
          ],
        },
      ],
    },
    {
      name: 'process',
      type: 'AssistantResponseCallback',
      description:
        'A callback in which you can run the assistant on threads, and send messages and data messages to the client.',
      properties: [
        {
          type: 'AssistantResponseCallback',
          parameters: [
            {
              name: 'forwardStream',
              type: '(stream: AssistantStream) => Run | undefined',
              description:
                'Forwards the assistant response stream to the client. Returns the Run object after it completes, or when it requires an action.',
            },
            {
              name: 'sendDataMessage',
              type: '(message: DataMessage) => void',
              description:
                'Send a data message to the client. You can use this to provide information for rendering custom UIs while the assistant is processing the thread.',
            },
          ],
        },
      ],
    },
  ]}
/>

---
title: convertToCoreMessages
description: Convert useChat messages to CoreMessages for AI core functions (API Reference)
---

# `convertToCoreMessages()`

<Note title="warning">
  The `convertToCoreMessages` function is no longer required. The AI SDK now
  automatically converts the incoming messages to the `CoreMessage` format.
</Note>

The `convertToCoreMessages` function is used to transform an array of UI messages from the `useChat` hook into an array of `CoreMessage` objects. These `CoreMessage` objects are compatible with AI core functions like `streamText`.

```ts filename="app/api/chat/route.ts"
import { openai } from '@ai-sdk/openai';
import { convertToCoreMessages, streamText } from 'ai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages: convertToCoreMessages(messages),
  });

  return result.toDataStreamResponse();
}
```

## Import

<Snippet text={`import { convertToCoreMessages } from "ai"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'messages',
      type: 'Message[]',
      description:
        'An array of UI messages from the useChat hook to be converted',
    },
    {
      name: 'options',
      type: '{ tools?: Record<string, Tool> }',
      description:
        'Optional configuration object. Provide tools to enable multi-modal tool responses.',
    },
  ]}
/>

### Returns

An array of [`CoreMessage`](/docs/reference/ai-sdk-core/core-message) objects.

<PropertiesTable
  content={[
    {
      name: 'CoreMessage[]',
      type: 'Array',
      description: 'An array of CoreMessage objects',
    },
  ]}
/>

## Multi-modal Tool Responses

The `convertToCoreMessages` function supports tools that can return multi-modal content. This is useful when tools need to return non-text content like images.

```ts
import { tool } from 'ai';
import { z } from 'zod';

const screenshotTool = tool({
  parameters: z.object({}),
  execute: async () => 'imgbase64',
  experimental_toToolResultContent: result => [{ type: 'image', data: result }],
});

const result = streamText({
  model: openai('gpt-4'),
  messages: convertToCoreMessages(messages, {
    tools: {
      screenshot: screenshotTool,
    },
  }),
});
```

Tools can implement the optional `experimental_toToolResultContent` method to transform their results into multi-modal content. The content is an array of content parts, where each part has a `type` (e.g., 'text', 'image') and corresponding data.

---
title: appendResponseMessages
description: Appends ResponseMessage[] from an AI response to an existing array of UI messages, generating timestamps and reusing IDs for useChat (API Reference)
---

# `appendResponseMessages()`

Appends an array of ResponseMessage objects (from the AI response) to an existing array of UI messages. It reuses the existing IDs from the response messages, generates new timestamps, and merges tool-call results with the previous assistant message (if any). This is useful for maintaining a unified message history when working with AI responses in a client-side chat application.

## Import

<Snippet text={`import { appendResponseMessages } from "ai"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'messages',
      type: 'Message[]',
      description:
        'An existing array of UI messages for useChat (usually from state).',
    },
    {
      name: 'responseMessages',
      type: 'ResponseMessage[]',
      description:
        'The new array of AI messages returned from the AI service to be appended. For example, "assistant" messages get added as new items, while tool-call results (role: "tool") are merged with the previous assistant message.',
    },
  ]}
/>

### Returns

An updated array of Message objects.

<PropertiesTable
  content={[
    {
      name: 'Message[]',
      type: 'Array',
      description:
        'A new array of UI messages with the appended AI response messages (and updated tool-call results for the preceding assistant message).',
    },
  ]}
/>

---
title: appendClientMessage
description: Appends or updates a client Message to an existing array of UI messages for useChat (API Reference)
---

# `appendClientMessage()`

Appends a client Message object to an existing array of UI messages. If the last message in the array has the same ID as the new message, it will replace the existing message instead of appending. This is useful for maintaining a unified message history in a client-side chat application, especially when updating existing messages.

## Import

<Snippet text={`import { appendClientMessage } from "ai"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'messages',
      type: 'Message[]',
      description:
        'An existing array of UI messages for useChat (usually from state).',
    },
    {
      name: 'message',
      type: 'Message',
      description:
        'The new client message to be appended or used to replace an existing message with the same ID.',
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'Message[]',
      type: 'Array',
      description:
        'A new array of UI messages with either the appended message or the updated message replacing the previous one with the same ID.',
    },
  ]}
/>

---
title: createDataStream
description: Learn to use createDataStream helper function to stream additional data in your application.
---

# `createDataStream`

The `createDataStream` function allows you to stream additional data to the client (see [Streaming Data](/docs/ai-sdk-ui/streaming-data)).

## Import

<Snippet text={`import { createDataStream } from "ai"`} prompt={false} />

## Example

```tsx
const stream = createDataStream({
  async execute(dataStream) {
    // Write data
    dataStream.writeData({ value: 'Hello' });

    // Write annotation
    dataStream.writeMessageAnnotation({ type: 'status', value: 'processing' });

    // Merge another stream
    const otherStream = getAnotherStream();
    dataStream.merge(otherStream);
  },
  onError: error => `Custom error: ${error.message}`,
});
```

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'execute',
      type: '(dataStream: DataStreamWriter) => Promise<void> | void',
      description:
        'A function that receives a DataStreamWriter instance and can use it to write data to the stream.',
      properties: [
        {
          type: 'DataStreamWriter',
          parameters: [
            {
              name: 'writeData',
              type: '(value: JSONValue) => void',
              description: 'Appends a data part to the stream.',
            },
            {
              name: 'writeMessageAnnotation',
              type: '(value: JSONValue) => void',
              description: 'Appends a message annotation to the stream.',
            },
            {
              name: 'merge',
              type: '(stream: ReadableStream<DataStreamString>) => void',
              description:
                'Merges the contents of another stream to this stream.',
            },
            {
              name: 'onError',
              type: '((error: unknown) => string) | undefined',
              description:
                'Error handler that is used by the data stream writer. This is intended for forwarding when merging streams to prevent duplicated error masking.',
            },
          ],
        },
      ],
    },
    {
      name: 'onError',
      type: '(error: unknown) => string',
      description:
        'A function that handles errors and returns an error message string. By default, it returns "An error occurred."',
    },
  ]}
/>

### Returns

`ReadableStream<DataStreamString>`

A readable stream that emits formatted data stream parts.

---
title: createDataStreamResponse
description: Learn to use createDataStreamResponse helper function to create a Response object with streaming data.
---

# `createDataStreamResponse`

The `createDataStreamResponse` function creates a Response object that streams data to the client (see [Streaming Data](/docs/ai-sdk-ui/streaming-data)).

## Import

<Snippet
  text={`import { createDataStreamResponse } from "ai"`}
  prompt={false}
/>

## Example

```tsx
const response = createDataStreamResponse({
  status: 200,
  statusText: 'OK',
  headers: {
    'Custom-Header': 'value',
  },
  async execute(dataStream) {
    // Write data
    dataStream.writeData({ value: 'Hello' });

    // Write annotation
    dataStream.writeMessageAnnotation({ type: 'status', value: 'processing' });

    // Merge another stream
    const otherStream = getAnotherStream();
    dataStream.merge(otherStream);
  },
  onError: error => `Custom error: ${error.message}`,
});
```

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'status',
      type: 'number',
      description: 'The status code for the response.',
    },
    {
      name: 'statusText',
      type: 'string',
      description: 'The status text for the response.',
    },
    {
      name: 'headers',
      type: 'Headers | Record<string, string>',
      description: 'Additional headers for the response.',
    },
    {
      name: 'execute',
      type: '(dataStream: DataStreamWriter) => Promise<void> | void',
      description:
        'A function that receives a DataStreamWriter instance and can use it to write data to the stream.',
      properties: [
        {
          type: 'DataStreamWriter',
          parameters: [
            {
              name: 'writeData',
              type: '(value: JSONValue) => void',
              description: 'Appends a data part to the stream.',
            },
            {
              name: 'writeMessageAnnotation',
              type: '(value: JSONValue) => void',
              description: 'Appends a message annotation to the stream.',
            },
            {
              name: 'merge',
              type: '(stream: ReadableStream<DataStreamString>) => void',
              description:
                'Merges the contents of another stream to this stream.',
            },
            {
              name: 'onError',
              type: '((error: unknown) => string) | undefined',
              description:
                'Error handler that is used by the data stream writer. This is intended for forwarding when merging streams to prevent duplicated error masking.',
            },
          ],
        },
      ],
    },
    {
      name: 'onError',
      type: '(error: unknown) => string',
      description:
        'A function that handles errors and returns an error message string. By default, it returns "An error occurred."',
    },
  ]}
/>

### Returns

`Response`

A Response object that streams formatted data stream parts with the specified status, headers, and content.

---
title: pipeDataStreamToResponse
description: Learn to use pipeDataStreamToResponse helper function to pipe streaming data to a ServerResponse object.
---

# `pipeDataStreamToResponse`

The `pipeDataStreamToResponse` function pipes streaming data to a Node.js ServerResponse object (see [Streaming Data](/docs/ai-sdk-ui/streaming-data)).

## Import

<Snippet
  text={`import { pipeDataStreamToResponse } from "ai"`}
  prompt={false}
/>

## Example

```tsx
pipeDataStreamToResponse(serverResponse, {
  status: 200,
  statusText: 'OK',
  headers: {
    'Custom-Header': 'value',
  },
  async execute(dataStream) {
    // Write data
    dataStream.writeData({ value: 'Hello' });

    // Write annotation
    dataStream.writeMessageAnnotation({ type: 'status', value: 'processing' });

    // Merge another stream
    const otherStream = getAnotherStream();
    dataStream.merge(otherStream);
  },
  onError: error => `Custom error: ${error.message}`,
});
```

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'response',
      type: 'ServerResponse',
      description: 'The Node.js ServerResponse object to pipe the data to.',
    },
    {
      name: 'status',
      type: 'number',
      description: 'The status code for the response.',
    },
    {
      name: 'statusText',
      type: 'string',
      description: 'The status text for the response.',
    },
    {
      name: 'headers',
      type: 'Headers | Record<string, string>',
      description: 'Additional headers for the response.',
    },
    {
      name: 'execute',
      type: '(dataStream: DataStreamWriter) => Promise<void> | void',
      description:
        'A function that receives a DataStreamWriter instance and can use it to write data to the stream.',
      properties: [
        {
          type: 'DataStreamWriter',
          parameters: [
            {
              name: 'writeData',
              type: '(value: JSONValue) => void',
              description: 'Appends a data part to the stream.',
            },
            {
              name: 'writeMessageAnnotation',
              type: '(value: JSONValue) => void',
              description: 'Appends a message annotation to the stream.',
            },
            {
              name: 'merge',
              type: '(stream: ReadableStream<DataStreamString>) => void',
              description:
                'Merges the contents of another stream to this stream.',
            },
            {
              name: 'onError',
              type: '((error: unknown) => string) | undefined',
              description:
                'Error handler that is used by the data stream writer. This is intended for forwarding when merging streams to prevent duplicated error masking.',
            },
          ],
        },
      ],
    },
    {
      name: 'onError',
      type: '(error: unknown) => string',
      description:
        'A function that handles errors and returns an error message string. By default, it returns "An error occurred."',
    },
  ]}
/>

---
title: StreamData
description: Learn to use streamData helper function in your application.
---

# `StreamData`

<Note type="warning">

The `StreamData` class is deprecated and will be removed in a future version of AI SDK.
Please use `createDataStream`, `createDataStreamResponse`, and `pipeDataStreamToResponse` instead.

</Note>

The `StreamData` class allows you to stream additional data to the client (see [Streaming Data](/docs/ai-sdk-ui/streaming-data)).

## Import

### React

<Snippet text={`import { StreamData } from "ai"`} prompt={false} />

## API Signature

### Constructor

```ts
const data = new StreamData();
```

### Methods

#### `append`

Appends a value to the stream data.

```ts
data.append(value: JSONValue)
```

#### `appendMessageAnnotation`

Appends a message annotation to the stream data.

```ts
data.appendMessageAnnotation(annotation: JSONValue)
```

#### `close`

Closes the stream data.

```ts
data.close();
```

---
title: AI SDK UI
description: Reference documentation for the AI SDK UI
collapsed: true
---

# AI SDK UI

[AI SDK UI](/docs/ai-sdk-ui) is designed to help you build interactive chat, completion, and assistant applications with ease.
It is framework-agnostic toolkit, streamlining the integration of advanced AI functionalities into your applications.

AI SDK UI contains the following hooks:

<IndexCards
  cards={[
    {
      title: 'useChat',
      description:
        'Use a hook to interact with language models in a chat interface.',
      href: '/docs/reference/ai-sdk-ui/use-chat',
    },
    {
      title: 'useCompletion',
      description:
        'Use a hook to interact with language models in a completion interface.',
      href: '/docs/reference/ai-sdk-ui/use-completion',
    },
    {
      title: 'useObject',
      description: 'Use a hook for consuming a streamed JSON objects.',
      href: '/docs/reference/ai-sdk-ui/use-object',
    },
    {
      title: 'useAssistant',
      description: 'Use a hook to interact with OpenAI assistants.',
      href: '/docs/reference/ai-sdk-ui/use-assistant',
    },
    {
      title: 'convertToCoreMessages',
      description:
        'Convert useChat messages to CoreMessages for AI core functions.',
      href: '/docs/reference/ai-sdk-ui/convert-to-core-messages',
    },
    {
      title: 'appendResponseMessages',
      description:
        'Append CoreMessage[] from an AI response to an existing array of UI messages.',
      href: '/docs/reference/ai-sdk-ui/append-response-messages',
    },
    {
      title: 'appendClientMessage',
      description:
        'Append a client message to an existing array of UI messages.',
      href: '/docs/reference/ai-sdk-ui/append-client-message',
    },
    {
      title: 'createDataStream',
      description:
        'Create a data stream to stream additional data to the client.',
      href: '/docs/reference/ai-sdk-ui/create-data-stream',
    },
    {
      title: 'createDataStreamResponse',
      description:
        'Create a response object to stream additional data to the client.',
      href: '/docs/reference/ai-sdk-ui/create-data-stream-response',
    },
    {
      title: 'pipeDataStreamToResponse',
      description: 'Pipe a data stream to a Node.js ServerResponse object.',
      href: '/docs/reference/ai-sdk-ui/pipe-data-stream-to-response',
    },
    {
      title: 'streamData',
      description:
        'Stream additional data to the client along with generations.',
      href: '/docs/reference/ai-sdk-ui/stream-data',
    },
  ]}
/>

It also contains the following helper functions:

<IndexCards
  cards={[
    {
      title: 'AssistantResponse',
      description: 'Streaming helper for assistant responses.',
      href: '/docs/reference/ai-sdk-ui/assistant-response',
    },
  ]}
/>

## UI Framework Support

AI SDK UI supports the following frameworks: [React](https://react.dev/), [Svelte](https://svelte.dev/), [Vue.js](https://vuejs.org/), and [SolidJS](https://www.solidjs.com/).
Here is a comparison of the supported functions across these frameworks:

| Function                                                  | React               | Svelte              | Vue.js              | SolidJS             |
| --------------------------------------------------------- | ------------------- | ------------------- | ------------------- | ------------------- |
| [useChat](/docs/reference/ai-sdk-ui/use-chat)             | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> |
| [useChat](/docs/reference/ai-sdk-ui/use-chat) attachments | <Check size={18} /> | <Cross size={18} /> | <Check size={18} /> | <Cross size={18} /> |
| [useCompletion](/docs/reference/ai-sdk-ui/use-completion) | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> |
| [useObject](/docs/reference/ai-sdk-ui/use-object)         | <Check size={18} /> | <Cross size={18} /> | <Cross size={18} /> | <Check size={18} /> |
| [useAssistant](/docs/reference/ai-sdk-ui/use-assistant)   | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> | <Check size={18} /> |

<Note>
  [Contributions](https://github.com/vercel/ai/blob/main/CONTRIBUTING.md) are
  welcome to implement missing features for non-React frameworks.
</Note>

---
title: streamUI
description: Reference for the streamUI function from the AI SDK RSC
---

# `streamUI`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

A helper function to create a streamable UI from LLM providers. This function is similar to AI SDK Core APIs and supports the same model interfaces.

To see `streamUI` in action, check out [these examples](#examples).

## Import

<Snippet text={`import { streamUI } from "ai/rsc"`} prompt={false} />

## Parameters

<PropertiesTable
  content={[
    {
      name: 'model',
      type: 'LanguageModel',
      description: 'The language model to use. Example: openai("gpt-4-turbo")',
    },
    {
      name: 'initial',
      isOptional: true,
      type: 'ReactNode',
      description: 'The initial UI to render.',
    },
    {
      name: 'system',
      type: 'string',
      description:
        'The system prompt to use that specifies the behavior of the model.',
    },
    {
      name: 'prompt',
      type: 'string',
      description: 'The input prompt to generate the text from.',
    },
    {
      name: 'messages',
      type: 'Array<CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage> | Array<UIMessage>',
      description:
        'A list of messages that represent a conversation. Automatically converts UI messages from the useChat hook.',
      properties: [
        {
          type: 'CoreSystemMessage',
          parameters: [
            {
              name: 'role',
              type: "'system'",
              description: 'The role for the system message.',
            },
            {
              name: 'content',
              type: 'string',
              description: 'The content of the message.',
            },
          ],
        },
        {
          type: 'CoreUserMessage',
          parameters: [
            {
              name: 'role',
              type: "'user'",
              description: 'The role for the user message.',
            },
            {
              name: 'content',
              type: 'string | Array<TextPart | ImagePart | FilePart>',
              description: 'The content of the message.',
              properties: [
                {
                  type: 'TextPart',
                  parameters: [
                    {
                      name: 'type',
                      type: "'text'",
                      description: 'The type of the message part.',
                    },
                    {
                      name: 'text',
                      type: 'string',
                      description: 'The text content of the message part.',
                    },
                  ],
                },
                {
                  type: 'ImagePart',
                  parameters: [
                    {
                      name: 'type',
                      type: "'image'",
                      description: 'The type of the message part.',
                    },
                    {
                      name: 'image',
                      type: 'string | Uint8Array | Buffer | ArrayBuffer | URL',
                      description:
                        'The image content of the message part. String are either base64 encoded content, base64 data URLs, or http(s) URLs.',
                    },
                    {
                      name: 'mimeType',
                      type: 'string',
                      isOptional: true,
                      description: 'The mime type of the image. Optional.',
                    },
                  ],
                },
                {
                  type: 'FilePart',
                  parameters: [
                    {
                      name: 'type',
                      type: "'file'",
                      description: 'The type of the message part.',
                    },
                    {
                      name: 'data',
                      type: 'string | Uint8Array | Buffer | ArrayBuffer | URL',
                      description:
                        'The file content of the message part. String are either base64 encoded content, base64 data URLs, or http(s) URLs.',
                    },
                    {
                      name: 'mimeType',
                      type: 'string',
                      description: 'The mime type of the file.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'CoreAssistantMessage',
          parameters: [
            {
              name: 'role',
              type: "'assistant'",
              description: 'The role for the assistant message.',
            },
            {
              name: 'content',
              type: 'string | Array<TextPart | ToolCallPart>',
              description: 'The content of the message.',
              properties: [
                {
                  type: 'TextPart',
                  parameters: [
                    {
                      name: 'type',
                      type: "'text'",
                      description: 'The type of the message part.',
                    },
                    {
                      name: 'text',
                      type: 'string',
                      description: 'The text content of the message part.',
                    },
                  ],
                },
                {
                  type: 'ToolCallPart',
                  parameters: [
                    {
                      name: 'type',
                      type: "'tool-call'",
                      description: 'The type of the message part.',
                    },
                    {
                      name: 'toolCallId',
                      type: 'string',
                      description: 'The id of the tool call.',
                    },
                    {
                      name: 'toolName',
                      type: 'string',
                      description:
                        'The name of the tool, which typically would be the name of the function.',
                    },
                    {
                      name: 'args',
                      type: 'object based on zod schema',
                      description:
                        'Parameters generated by the model to be used by the tool.',
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'CoreToolMessage',
          parameters: [
            {
              name: 'role',
              type: "'tool'",
              description: 'The role for the assistant message.',
            },
            {
              name: 'content',
              type: 'Array<ToolResultPart>',
              description: 'The content of the message.',
              properties: [
                {
                  type: 'ToolResultPart',
                  parameters: [
                    {
                      name: 'type',
                      type: "'tool-result'",
                      description: 'The type of the message part.',
                    },
                    {
                      name: 'toolCallId',
                      type: 'string',
                      description:
                        'The id of the tool call the result corresponds to.',
                    },
                    {
                      name: 'toolName',
                      type: 'string',
                      description:
                        'The name of the tool the result corresponds to.',
                    },
                    {
                      name: 'result',
                      type: 'unknown',
                      description:
                        'The result returned by the tool after execution.',
                    },
                    {
                      name: 'isError',
                      type: 'boolean',
                      isOptional: true,
                      description:
                        'Whether the result is an error or an error message.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'maxTokens',
      type: 'number',
      isOptional: true,
      description: 'Maximum number of tokens to generate.',
    },
    {
      name: 'temperature',
      type: 'number',
      isOptional: true,
      description:
        'Temperature setting. The value is passed through to the provider. The range depends on the provider and model. It is recommended to set either `temperature` or `topP`, but not both.',
    },
    {
      name: 'topP',
      type: 'number',
      isOptional: true,
      description:
        'Nucleus sampling. The value is passed through to the provider. The range depends on the provider and model. It is recommended to set either `temperature` or `topP`, but not both.',
    },
    {
      name: 'topK',
      type: 'number',
      isOptional: true,
      description:
        'Only sample from the top K options for each subsequent token. Used to remove "long tail" low probability responses. Recommended for advanced use cases only. You usually only need to use temperature.',
    },
    {
      name: 'presencePenalty',
      type: 'number',
      isOptional: true,
      description:
        'Presence penalty setting. It affects the likelihood of the model to repeat information that is already in the prompt. The value is passed through to the provider. The range depends on the provider and model.',
    },
    {
      name: 'frequencyPenalty',
      type: 'number',
      isOptional: true,
      description:
        'Frequency penalty setting. It affects the likelihood of the model to repeatedly use the same words or phrases. The value is passed through to the provider. The range depends on the provider and model.',
    },
    {
      name: 'stopSequences',
      type: 'string[]',
      isOptional: true,
      description:
        'Sequences that will stop the generation of the text. If the model generates any of these sequences, it will stop generating further text.',
    },
    {
      name: 'seed',
      type: 'number',
      isOptional: true,
      description:
        'The seed (integer) to use for random sampling. If set and supported by the model, calls will generate deterministic results.',
    },
    {
      name: 'maxRetries',
      type: 'number',
      isOptional: true,
      description:
        'Maximum number of retries. Set to 0 to disable retries. Default: 2.',
    },
    {
      name: 'abortSignal',
      type: 'AbortSignal',
      isOptional: true,
      description:
        'An optional abort signal that can be used to cancel the call.',
    },
    {
      name: 'headers',
      type: 'Record<string, string>',
      isOptional: true,
      description:
        'Additional HTTP headers to be sent with the request. Only applicable for HTTP-based providers.',
    },
    {
      name: 'tools',
      type: 'Record<string, Tool>',
      description:
        'Tools that are accessible to and can be called by the model.',
      properties: [
        {
          type: 'Tool',
          parameters: [
            {
              name: 'description',
              isOptional: true,
              type: 'string',
              description:
                'Information about the purpose of the tool including details on how and when it can be used by the model.',
            },
            {
              name: 'parameters',
              type: 'zod schema',
              description:
                'The typed schema that describes the parameters of the tool that can also be used to validation and error handling.',
            },
            {
              name: 'generate',
              isOptional: true,
              type: '(async (parameters) => ReactNode) | AsyncGenerator<ReactNode, ReactNode, void>',
              description:
                'A function or a generator function that is called with the arguments from the tool call and yields React nodes as the UI.',
            },
          ],
        },
      ],
    },
    {
      name: 'toolChoice',
      isOptional: true,
      type: '"auto" | "none" | "required" | { "type": "tool", "toolName": string }',
      description:
        'The tool choice setting. It specifies how tools are selected for execution. The default is "auto". "none" disables tool execution. "required" requires tools to be executed. { "type": "tool", "toolName": string } specifies a specific tool to execute.',
    },
    {
      name: 'text',
      isOptional: true,
      type: '(Text) => ReactNode',
      description: 'Callback to handle the generated tokens from the model.',
      properties: [
        {
          type: 'Text',
          parameters: [
            {
              name: 'content',
              type: 'string',
              description: 'The full content of the completion.',
            },
            { name: 'delta', type: 'string', description: 'The delta.' },
            { name: 'done', type: 'boolean', description: 'Is it done?' },
          ],
        },
      ],
    },
    {
      name: 'experimental_providerMetadata',
      type: 'Record<string,Record<string,JSONValue>> | undefined',
      isOptional: true,
      description:
        'Optional metadata from the provider. The outer key is the provider name. The inner values are the metadata. Details depend on the provider.',
    },
    {
      name: 'onFinish',
      type: '(result: OnFinishResult) => void',
      isOptional: true,
      description:
        'Callback that is called when the LLM response and all request tool executions (for tools that have a `generate` function) are finished.',
      properties: [
        {
          type: 'OnFinishResult',
          parameters: [
            {
              name: 'usage',
              type: 'TokenUsage',
              description: 'The token usage of the generated text.',
              properties: [
                {
                  type: 'TokenUsage',
                  parameters: [
                    {
                      name: 'promptTokens',
                      type: 'number',
                      description: 'The total number of tokens in the prompt.',
                    },
                    {
                      name: 'completionTokens',
                      type: 'number',
                      description:
                        'The total number of tokens in the completion.',
                    },
                    {
                      name: 'totalTokens',
                      type: 'number',
                      description: 'The total number of tokens generated.',
                    },
                  ],
                },
              ],
            },
            {
              name: 'value',
              type: 'ReactNode',
              description: 'The final ui node that was generated.',
            },
            {
              name: 'warnings',
              type: 'Warning[] | undefined',
              description:
                'Warnings from the model provider (e.g. unsupported settings).',
            },
            {
              name: 'rawResponse',
              type: 'RawResponse',
              description: 'Optional raw response data.',
              properties: [
                {
                  type: 'RawResponse',
                  parameters: [
                    {
                      name: 'headers',
                      isOptional: true,
                      type: 'Record<string, string>',
                      description: 'Response headers.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ]}
/>

## Returns

<PropertiesTable
  content={[
    {
      name: 'value',
      type: 'ReactNode',
      description: 'The user interface based on the stream output.',
    },
    {
      name: 'rawResponse',
      type: 'RawResponse',
      isOptional: true,
      description: 'Optional raw response data.',
      properties: [
        {
          type: 'RawResponse',
          parameters: [
            {
              name: 'headers',
              isOptional: true,
              type: 'Record<string, string>',
              description: 'Response headers.',
            },
          ],
        },
      ],
    },
    {
      name: 'warnings',
      type: 'Warning[] | undefined',
      description:
        'Warnings from the model provider (e.g. unsupported settings).',
    },
    {
      name: 'stream',
      type: 'AsyncIterable<StreamPart> & ReadableStream<StreamPart>',
      description:
        'A stream with all events, including text deltas, tool calls, tool results, and errors. You can use it as either an AsyncIterable or a ReadableStream. When an error occurs, the stream will throw the error.',
      properties: [
        {
          type: 'StreamPart',
          parameters: [
            {
              name: 'type',
              type: "'text-delta'",
              description: 'The type to identify the object as text delta.',
            },
            {
              name: 'textDelta',
              type: 'string',
              description: 'The text delta.',
            },
          ],
        },
        {
          type: 'StreamPart',
          parameters: [
            {
              name: 'type',
              type: "'tool-call'",
              description: 'The type to identify the object as tool call.',
            },
            {
              name: 'toolCallId',
              type: 'string',
              description: 'The id of the tool call.',
            },
            {
              name: 'toolName',
              type: 'string',
              description:
                'The name of the tool, which typically would be the name of the function.',
            },
            {
              name: 'args',
              type: 'object based on zod schema',
              description:
                'Parameters generated by the model to be used by the tool.',
            },
          ],
        },
        {
          type: 'StreamPart',
          parameters: [
            {
              name: 'type',
              type: "'error'",
              description: 'The type to identify the object as error.',
            },
            {
              name: 'error',
              type: 'Error',
              description:
                'Describes the error that may have occurred during execution.',
            },
          ],
        },
        {
          type: 'StreamPart',
          parameters: [
            {
              name: 'type',
              type: "'finish'",
              description: 'The type to identify the object as finish.',
            },
            {
              name: 'finishReason',
              type: "'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other' | 'unknown'",
              description: 'The reason the model finished generating the text.',
            },
            {
              name: 'usage',
              type: 'TokenUsage',
              description: 'The token usage of the generated text.',
              properties: [
                {
                  type: 'TokenUsage',
                  parameters: [
                    {
                      name: 'promptTokens',
                      type: 'number',
                      description: 'The total number of tokens in the prompt.',
                    },
                    {
                      name: 'completionTokens',
                      type: 'number',
                      description:
                        'The total number of tokens in the completion.',
                    },
                    {
                      name: 'totalTokens',
                      type: 'number',
                      description: 'The total number of tokens generated.',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ]}
/>

## Examples

<ExampleLinks
  examples={[
    {
      title:
        'Learn to render a React component as a function call using a language model in Next.js',
      link: '/examples/next-app/state-management/ai-ui-states',
    },
    {
      title: 'Learn to persist and restore states UI/AI states in Next.js',
      link: '/examples/next-app/state-management/save-and-restore-states',
    },
    {
      title:
        'Learn to route React components using a language model in Next.js',
      link: '/examples/next-app/interface/route-components',
    },
    {
      title: 'Learn to stream component updates to the client in Next.js',
      link: '/examples/next-app/interface/stream-component-updates',
    },
  ]}
/>

---
title: createAI
description: Reference for the createAI function from the AI SDK RSC
---

# `createAI`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

Creates a client-server context provider that can be used to wrap parts of your application tree to easily manage both UI and AI states of your application.

## Import

<Snippet text={`import { createAI } from "ai/rsc"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'actions',
      type: 'Record<string, Action>',
      description: 'Server side actions that can be called from the client.',
    },
    {
      name: 'initialAIState',
      type: 'any',
      description: 'Initial AI state to be used in the client.',
    },
    {
      name: 'initialUIState',
      type: 'any',
      description: 'Initial UI state to be used in the client.',
    },
    {
      name: 'onGetUIState',
      type: '() => UIState',
      description: 'is called during SSR to compare and update UI state.',
    },
    {
      name: 'onSetAIState',
      type: '(Event) => void',
      description:
        'is triggered whenever an update() or done() is called by the mutable AI state in your action, so you can safely store your AI state in the database.',
      properties: [
        {
          type: 'Event',
          parameters: [
            {
              name: 'state',
              type: 'AIState',
              description: 'The resulting AI state after the update.',
            },
            {
              name: 'done',
              type: 'boolean',
              description:
                'Whether the AI state updates have been finalized or not.',
            },
          ],
        },
      ],
    },
  ]}
/>

### Returns

It returns an `<AI/>` context provider.

## Examples

<ExampleLinks
  examples={[
    {
      title: 'Learn to manage AI and UI states in Next.js',
      link: '/examples/next-app/state-management/ai-ui-states',
    },
    {
      title: 'Learn to persist and restore states UI/AI states in Next.js',
      link: '/examples/next-app/state-management/save-and-restore-states',
    },
  ]}
/>

---
title: createStreamableUI
description: Reference for the createStreamableUI function from the AI SDK RSC
---

# `createStreamableUI`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

Create a stream that sends UI from the server to the client. On the client side, it can be rendered as a normal React node.

## Import

<Snippet text={`import { createStreamableUI } from "ai/rsc"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'initialValue',
      type: 'ReactNode',
      isOptional: true,
      description: 'The initial value of the streamable UI.',
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'value',
      type: 'ReactNode',
      description:
        'The value of the streamable UI. This can be returned from a Server Action and received by the client.',
    },
  ]}
/>

### Methods

<PropertiesTable
  content={[
    {
      name: 'update',
      type: '(ReactNode) => void',
      description:
        'Updates the current UI node. It takes a new UI node and replaces the old one.',
    },
    {
      name: 'append',
      type: '(ReactNode) => void',
      description:
        'Appends a new UI node to the end of the old one. Once appended a new UI node, the previous UI node cannot be updated anymore.',
    },
    {
      name: 'done',
      type: '(ReactNode | null) => void',
      description:
        'Marks the UI node as finalized and closes the stream. Once called, the UI node cannot be updated or appended anymore. This method is always required to be called, otherwise the response will be stuck in a loading state.',
    },
    {
      name: 'error',
      type: '(Error) => void',
      description:
        'Signals that there is an error in the UI stream. It will be thrown on the client side and caught by the nearest error boundary component.',
    },
  ]}
/>

## Examples

<ExampleLinks
  examples={[
    {
      title: 'Render a React component during a tool call',
      link: '/examples/next-app/tools/render-interface-during-tool-call',
    },
  ]}
/>

---
title: createStreamableValue
description: Reference for the createStreamableValue function from the AI SDK RSC
---

# `createStreamableValue`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

Create a stream that sends values from the server to the client. The value can be any serializable data.

## Import

<Snippet
  text={`import { createStreamableValue } from "ai/rsc"`}
  prompt={false}
/>

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'value',
      type: 'any',
      description: 'Any data that RSC supports. Example, JSON.',
    },
  ]}
/>

### Returns

<PropertiesTable
  content={[
    {
      name: 'value',
      type: 'streamable',
      description:
        'This creates a special value that can be returned from Actions to the client. It holds the data inside and can be updated via the update method.',
    },
  ]}
/>

---
title: readStreamableValue
description: Reference for the readStreamableValue function from the AI SDK RSC
---

# `readStreamableValue`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

It is a function that helps you read the streamable value from the client that was originally created using [`createStreamableValue`](/docs/reference/ai-sdk-rsc/create-streamable-value) on the server.

## Import

<Snippet text={`import { readStreamableValue } from "ai/rsc"`} prompt={false} />

## Example

```ts filename="app/actions.ts"
async function generate() {
  'use server';
  const streamable = createStreamableValue();

  streamable.update(1);
  streamable.update(2);
  streamable.done(3);

  return streamable.value;
}
```

```tsx filename="app/page.tsx" highlight="12"
import { readStreamableValue } from 'ai/rsc';

export default function Page() {
  const [generation, setGeneration] = useState('');

  return (
    <div>
      <button
        onClick={async () => {
          const stream = await generate();

          for await (const delta of readStreamableValue(stream)) {
            setGeneration(generation => generation + delta);
          }
        }}
      >
        Generate
      </button>
    </div>
  );
}
```

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'stream',
      type: 'StreamableValue',
      description: 'The streamable value to read from.',
    },
  ]}
/>

### Returns

It returns an async iterator that contains the values emitted by the streamable value.

---
title: getAIState
description: Reference for the getAIState function from the AI SDK RSC
---

# `getAIState`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

Get the current AI state.

## Import

<Snippet text={`import { getAIState } from "ai/rsc"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'key',
      type: 'string',
      isOptional: true,
      description:
        "Returns the value of the specified key in the AI state, if it's an object.",
    },
  ]}
/>

### Returns

The AI state.

## Examples

<ExampleLinks
  examples={[
    {
      title:
        'Learn to render a React component during a tool call made by a language model in Next.js',
      link: '/examples/next-app/tools/render-interface-during-tool-call',
    },
  ]}
/>

---
title: getMutableAIState
description: Reference for the getMutableAIState function from the AI SDK RSC
---

# `getMutableAIState`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

Get a mutable copy of the AI state. You can use this to update the state in the server.

## Import

<Snippet text={`import { getMutableAIState } from "ai/rsc"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'key',
      isOptional: true,
      type: 'string',
      description:
        "Returns the value of the specified key in the AI state, if it's an object.",
    },
  ]}
/>

### Returns

The mutable AI state.

### Methods

<PropertiesTable
  content={[
    {
      name: 'update',
      type: '(newState: any) => void',
      description: 'Updates the AI state with the new state.',
    },
    {
      name: 'done',
      type: '(newState: any) => void',
      description:
        'Updates the AI state with the new state, marks it as finalized and closes the stream.',
    },
  ]}
/>

## Examples

<ExampleLinks
  examples={[
    {
      title: 'Learn to persist and restore states AI and UI states in Next.js',
      link: '/examples/next-app/state-management/save-and-restore-states',
    },
  ]}
/>

---
title: useAIState
description: Reference for the useAIState function from the AI SDK RSC
---

# `useAIState`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

It is a hook that enables you to read and update the AI state. The AI state is shared globally between all `useAIState` hooks under the same `<AI/>` provider.

The AI state is intended to contain context and information shared with the AI model, such as system messages, function responses, and other relevant data.

## Import

<Snippet text={`import { useAIState } from "ai/rsc"`} prompt={false} />

## API Signature

### Returns

A single element array where the first element is the current AI state.

---
title: useActions
description: Reference for the useActions function from the AI SDK RSC
---

# `useActions`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

It is a hook to help you access your Server Actions from the client. This is particularly useful for building interfaces that require user interactions with the server.

It is required to access these server actions via this hook because they are patched when passed through the context. Accessing them directly may result in a [Cannot find Client Component error](/docs/troubleshooting/common-issues/server-actions-in-client-components).

## Import

<Snippet text={`import { useActions } from "ai/rsc"`} prompt={false} />

## API Signature

### Returns

`Record<string, Action>`, a dictionary of server actions.

## Examples

<ExampleLinks
  examples={[
    {
      title: 'Learn to manage AI and UI states in Next.js',
      link: '/examples/next-app/state-management/ai-ui-states',
    },
    {
      title:
        'Learn to route React components using a language model in Next.js',
      link: '/examples/next-app/interface/route-components',
    },
  ]}
/>

---
title: useUIState
description: Reference for the useUIState function from the AI SDK RSC
---

# `useUIState`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

It is a hook that enables you to read and update the UI State. The state is client-side and can contain functions, React nodes, and other data. UIState is the visual representation of the AI state.

## Import

<Snippet text={`import { useUIState } from "ai/rsc"`} prompt={false} />

## API Signature

### Returns

Similar to useState, it is an array, where the first element is the current UI state and the second element is the function that updates the state.

## Examples

<ExampleLinks
  examples={[
    {
      title: 'Learn to manage AI and UI states in Next.js',
      link: '/examples/next-app/state-management/ai-ui-states',
    },
  ]}
/>

---
title: useStreamableValue
description: Reference for the useStreamableValue function from the AI SDK RSC
---

# `useStreamableValue`

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

It is a React hook that takes a streamable value created using [`createStreamableValue`](/docs/reference/ai-sdk-rsc/create-streamable-value) and returns the current value, error, and pending state.

## Import

<Snippet text={`import { useStreamableValue } from "ai/rsc"`} prompt={false} />

## Example

This is useful for consuming streamable values received from a component's props.

```tsx
function MyComponent({ streamableValue }) {
  const [data, error, pending] = useStreamableValue(streamableValue);

  if (pending) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>Data: {data}</div>;
}
```

## API Signature

### Parameters

It accepts a streamable value created using `createStreamableValue`.

### Returns

It is an array, where the first element contains the data, the second element contains an error if it is thrown anytime during the stream, and the third is a boolean indicating if the value is pending.

---
title: render (Removed)
description: Reference for the render function from the AI SDK RSC
---

# `render` (Removed)

<Note type="warning">"render" has been removed in AI SDK 4.0.</Note>

<Note type="warning">
  AI SDK RSC is currently experimental. We recommend using [AI SDK
  UI](/docs/ai-sdk-ui/overview) for production. For guidance on migrating from
  RSC to UI, see our [migration guide](/docs/ai-sdk-rsc/migrating-to-ui).
</Note>

A helper function to create a streamable UI from LLM providers. This function is similar to AI SDK Core APIs and supports the same model interfaces.

> **Note**: `render` has been deprecated in favor of [`streamUI`](/docs/reference/ai-sdk-rsc/stream-ui). During migration, please ensure that the `messages` parameter follows the updated [specification](/docs/reference/ai-sdk-rsc/stream-ui#messages).

## Import

<Snippet text={`import { render } from "ai/rsc"`} prompt={false} />

## API Signature

### Parameters

<PropertiesTable
  content={[
    {
      name: 'model',
      type: 'string',
      description: 'Model identifier, must be OpenAI SDK compatible.',
    },
    {
      name: 'provider',
      type: 'provider client',
      description:
        'Currently the only provider available is OpenAI. This needs to match the model name.',
    },
    {
      name: 'initial',
      isOptional: true,
      type: 'ReactNode',
      description: 'The initial UI to render.',
    },
    {
      name: 'messages',
      type: 'Array<SystemMessage | UserMessage | AssistantMessage | ToolMessage>',
      description: 'A list of messages that represent a conversation.',
      properties: [
        {
          type: 'SystemMessage',
          parameters: [
            {
              name: 'role',
              type: "'system'",
              description: 'The role for the system message.',
            },
            {
              name: 'content',
              type: 'string',
              description: 'The content of the message.',
            },
          ],
        },
        {
          type: 'UserMessage',
          parameters: [
            {
              name: 'role',
              type: "'user'",
              description: 'The role for the user message.',
            },
            {
              name: 'content',
              type: 'string',
              description: 'The content of the message.',
            },
          ],
        },
        {
          type: 'AssistantMessage',
          parameters: [
            {
              name: 'role',
              type: "'assistant'",
              description: 'The role for the assistant message.',
            },
            {
              name: 'content',
              type: 'string',
              description: 'The content of the message.',
            },
            {
              name: 'tool_calls',
              type: 'ToolCall[]',
              description: 'A list of tool calls made by the model.',
              properties: [
                {
                  type: 'ToolCall',
                  parameters: [
                    {
                      name: 'id',
                      type: 'string',
                      description: 'The id of the tool call.',
                    },
                    {
                      name: 'type',
                      type: "'function'",
                      description: 'The type of the tool call.',
                    },
                    {
                      name: 'function',
                      type: 'Function',
                      description: 'The function to call.',
                      properties: [
                        {
                          type: 'Function',
                          parameters: [
                            {
                              name: 'name',
                              type: 'string',
                              description: 'The name of the function.',
                            },
                            {
                              name: 'arguments',
                              type: 'string',
                              description: 'The arguments of the function.',
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'ToolMessage',
          parameters: [
            {
              name: 'role',
              type: "'tool'",
              description: 'The role for the tool message.',
            },
            {
              name: 'content',
              type: 'string',
              description: 'The content of the message.',
            },
            {
              name: 'toolCallId',
              type: 'string',
              description: 'The id of the tool call.',
            },
          ],
        },
      ],
    },
    {
      name: 'functions',
      type: 'Record<string, Tool>',
      isOptional: true,
      description:
        'Tools that are accessible to and can be called by the model.',
      properties: [
        {
          type: 'Tool',
          parameters: [
            {
              name: 'description',
              isOptional: true,
              type: 'string',
              description:
                'Information about the purpose of the tool including details on how and when it can be used by the model.',
            },
            {
              name: 'parameters',
              type: 'zod schema',
              description:
                'The typed schema that describes the parameters of the tool that can also be used to validation and error handling.',
            },
            {
              name: 'render',
              isOptional: true,
              type: 'async (parameters) => any',
              description:
                'An async function that is called with the arguments from the tool call and produces a result.',
            },
          ],
        },
      ],
    },
    {
      name: 'tools',
      type: 'Record<string, Tool>',
      isOptional: true,
      description:
        'Tools that are accessible to and can be called by the model.',
      properties: [
        {
          type: 'Tool',
          parameters: [
            {
              name: 'description',
              isOptional: true,
              type: 'string',
              description:
                'Information about the purpose of the tool including details on how and when it can be used by the model.',
            },
            {
              name: 'parameters',
              type: 'zod schema',
              description:
                'The typed schema that describes the parameters of the tool that can also be used to validation and error handling.',
            },
            {
              name: 'render',
              isOptional: true,
              type: 'async (parameters) => any',
              description:
                'An async function that is called with the arguments from the tool call and produces a result.',
            },
          ],
        },
      ],
    },
    {
      name: 'text',
      isOptional: true,
      type: '(Text) => ReactNode',
      description: 'Callback to handle the generated tokens from the model.',
      properties: [
        {
          type: 'Text',
          parameters: [
            {
              name: 'content',
              type: 'string',
              description: 'The full content of the completion.',
            },
            { name: 'delta', type: 'string', description: 'The delta.' },
            { name: 'done', type: 'boolean', description: 'Is it done?' },
          ],
        },
      ],
    },
    {
      name: 'temperature',
      isOptional: true,
      type: 'number',
      description: 'The temperature to use for the model.',
    },
  ]}
/>

### Returns

It can return any valid ReactNode.