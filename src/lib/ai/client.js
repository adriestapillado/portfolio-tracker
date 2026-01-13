import OpenAI from 'openai';
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from '@anthropic-ai/sdk';
import { TOOLS, executeTool } from './tools';
import { SYSTEM_PROMPT } from './prompts';

/**
 * Stateless helper to run a chat turn with tool execution loop manually
 * Supports: openai, sonar, gemini, claude
 */
export async function runChatTurn(apiKey, history, context, onStatusUpdate, provider = 'openai') {
    onStatusUpdate("Pensando...");

    try {
        switch (provider) {
            case 'openai':
            case 'sonar':
                return await runOpenAICompatible(apiKey, history, context, onStatusUpdate, provider);
            case 'gemini':
                return await runGemini(apiKey, history, context, onStatusUpdate);
            case 'claude':
                return await runClaude(apiKey, history, context, onStatusUpdate);
            default:
                throw new Error(`Provider no soportado: ${provider}`);
        }
    } catch (e) {
        console.error("Chat Error", e);
        return { error: e.message };
    }
}

async function runOpenAICompatible(apiKey, history, context, onStatusUpdate, provider) {
    const isSonar = provider === 'sonar';
    const client = new OpenAI({
        apiKey: apiKey,
        baseURL: isSonar ? 'https://api.perplexity.ai' : undefined,
        dangerouslyAllowBrowser: true
    });

    const model = isSonar ? 'sonar-pro' : 'gpt-4o';

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history
    ];

    // Perplexity Sonar doesn't support function calling/tools
    // Note: Perplexity API may have CORS restrictions for browser-based requests
    if (isSonar) {
        try {
            const completion = await client.chat.completions.create({
                model: model,
                messages: messages
            });

            const responseMessage = completion.choices[0].message;
            return {
                content: responseMessage.content,
                history: [...history, responseMessage]
            };
        } catch (error) {
            console.error("Perplexity API Error Details:", error);
            // Perplexity may not support browser-based requests (CORS)
            throw new Error(`Perplexity Sonar error: ${error.message}. Note: Perplexity may not support browser-based API calls due to CORS restrictions. Consider using OpenAI or Gemini instead.`);
        }
    }

    // OpenAI with tools support
    const completion = await client.chat.completions.create({
        model: model,
        messages: messages,
        tools: TOOLS,
        tool_choice: "auto",
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls) {
        onStatusUpdate("Analyzing your data...");
        const newHistory = [...history, responseMessage];

        for (const toolCall of responseMessage.tool_calls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            const toolResult = await executeTool(functionName, functionArgs, context);

            newHistory.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: JSON.stringify(toolResult)
            });
        }

        const finalResponse = await client.chat.completions.create({
            model: model,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                ...newHistory
            ]
        });

        return {
            content: finalResponse.choices[0].message.content,
            history: [...newHistory, finalResponse.choices[0].message]
        };
    }

    return {
        content: responseMessage.content,
        history: [...history, responseMessage]
    };
}

async function runGemini(apiKey, history, context, onStatusUpdate) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Gemini requires first message to be 'user', filter out any leading assistant messages
    // and exclude the last message which we'll send separately
    const filteredHistory = history.filter(m => m.role !== 'system' && m.role !== 'tool');

    // Find the first user message index
    let startIndex = 0;
    for (let i = 0; i < filteredHistory.length; i++) {
        if (filteredHistory[i].role === 'user') {
            startIndex = i;
            break;
        }
    }

    // Take history from first user message, excluding the last message (which we'll send)
    const historyForGemini = filteredHistory.slice(startIndex, -1);

    // Format history for Gemini
    const contents = historyForGemini.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
    }));

    // Add tools (Gemini tool format)
    const geminiTools = [
        {
            functionDeclarations: TOOLS.map(t => ({
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
            }))
        }
    ];

    const chat = model.startChat({
        history: contents.length > 0 ? contents : undefined,
        systemInstruction: {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT }]
        },
        tools: geminiTools
    });

    const lastMsg = history[history.length - 1].content;
    let result = await chat.sendMessage(typeof lastMsg === 'string' ? lastMsg : JSON.stringify(lastMsg));
    let response = result.response;
    let call = response.candidates[0].content.parts.find(p => p.functionCall);

    const newHistory = [...history];

    while (call) {
        onStatusUpdate("Analizando tus datos...");
        const functionName = call.functionCall.name;
        const functionArgs = call.functionCall.args;

        const toolResult = await executeTool(functionName, functionArgs, context);

        // Add model's call to history for internal tracking if needed, 
        // but Gemini SDK handles the chat state.

        result = await chat.sendMessage([{
            functionResponse: {
                name: functionName,
                response: { content: JSON.stringify(toolResult) }
            }
        }]);

        response = result.response;
        call = response.candidates[0].content.parts.find(p => p.functionCall);
    }

    // Convert Gemini history back to our format
    // This is tricky because we want the full history. 
    // Gemini SDK state might be hidden, but we can reconstruct it or just return final.
    // For now, let's append the final response.
    const finalContent = response.text();

    return {
        content: finalContent,
        history: [...history, { role: 'assistant', content: finalContent }]
    };
}

async function runClaude(apiKey, history, context, onStatusUpdate) {
    const client = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
    });

    const model = "claude-3-5-sonnet-latest";

    // Format tools for Claude
    const claudeTools = TOOLS.map(t => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters
    }));

    let messages = history.map(m => ({
        role: m.role,
        content: m.content
    }));

    let response = await client.messages.create({
        model: model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: messages,
        tools: claudeTools
    });

    const newHistory = [...history];

    while (response.stop_reason === "tool_use") {
        onStatusUpdate("Analizando tus datos...");

        // Add assistant's response with tool use to history
        newHistory.push({
            role: "assistant",
            content: response.content
        });

        const toolResults = [];

        for (const content of response.content) {
            if (content.type === "tool_use") {
                const result = await executeTool(content.name, content.input, context);
                toolResults.push({
                    type: "tool_result",
                    tool_use_id: content.id,
                    content: JSON.stringify(result)
                });
            }
        }

        // Add tool results to messages
        newHistory.push({
            role: "user",
            content: toolResults
        });

        // Continue conversation
        response = await client.messages.create({
            model: model,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages: newHistory.map(m => ({ role: m.role, content: m.content })),
            tools: claudeTools
        });
    }

    const finalContent = response.content[0].text;

    return {
        content: finalContent,
        history: [...newHistory, { role: "assistant", content: finalContent }]
    };
}
