import os
from openai import AsyncOpenAI
from typing import List, Dict, AsyncGenerator 

# Load prompts
def load_prompt(filename: str) -> str:
    try:
        path = os.path.join(os.path.dirname(__file__), "..", "prompts", filename)
        with open(path, "r") as f:
            return f.read().strip()
    except Exception as e:
        print(f"Error loading prompt {filename}: {e}")
        return ""

SYSTEM_CHAT_PROMPT = load_prompt("system_chat.txt") or "You are a helpful AI assistant."
SYSTEM_TRANSLATE_PROMPT = load_prompt("system_translate.txt") or "You are a translator."

class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    async def generate_chat_stream(
        self, 
        history: List[Dict[str, str]], 
        model: str
    ) -> AsyncGenerator[str, None]:
        
        # Ensure system prompt is first
        messages = [{"role": "system", "content": SYSTEM_CHAT_PROMPT}]
        # Append history
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})

        stream = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def translate_text_stream(self, text: str, target_lang: str) -> AsyncGenerator[str, None]:
        system_content = SYSTEM_TRANSLATE_PROMPT.format(target_lang=target_lang)
        
        stream = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": text}
            ],
            stream=True
        )

        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    async def translate_text(self, text: str, target_lang: str) -> str:
        system_content = SYSTEM_TRANSLATE_PROMPT.format(target_lang=target_lang)
        
        completion = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": text}
            ]
        )
        return completion.choices[0].message.content or ""

llm_service = LLMService()
