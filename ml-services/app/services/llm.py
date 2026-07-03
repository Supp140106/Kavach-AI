# import time

# from app.core.config import client, MODEL_NAME


# def ask_llm(system_prompt: str, user_prompt: str):
#     start = time.perf_counter()

#     response = client.chat(
#         model=MODEL_NAME,
#         messages=[
#             {
#                 "role": "system",
#                 "content": system_prompt,
#             },
#             {
#                 "role": "user",
#                 "content": user_prompt,
#             },
#         ],
#     )

#     elapsed = round((time.perf_counter() - start) * 1000)

#     return {
#         "response": response.message.content,
#         "processing_time_ms": elapsed,
#         "model": MODEL_NAME,
#     }

# services/llm.py
import time
from app.core.config import client, MODEL_NAME


def _extract_text(response):
    if response is None:
        return ""

    if hasattr(response, "text") and response.text:
        return response.text

    if hasattr(response, "output_text") and response.output_text:
        return response.output_text

    if hasattr(response, "output"):
        output = response.output
        if isinstance(output, list) and output:
            first = output[0]
            if isinstance(first, dict) and "content" in first:
                content = first["content"]
                if isinstance(content, list) and content:
                    first_content = content[0]
                    if isinstance(first_content, dict) and "text" in first_content:
                        return first_content["text"]
                    if isinstance(first_content, str):
                        return first_content

    return str(response)


def ask_llm(system_prompt: str, user_prompt: str):
    start = time.perf_counter()

    raw_text = ""

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=user_prompt,
            config={
                "system_instruction": system_prompt,
                "temperature": 0.2,
                "response_mime_type": "application/json",
            }
        )
        raw_text = _extract_text(response)
    except Exception:
        # fallback to more permissive plain text response if JSON generation fails
        fallback = client.models.generate_content(
            model=MODEL_NAME,
            contents=user_prompt,
            config={
                "system_instruction": system_prompt,
                "temperature": 0.2,
            }
        )
        raw_text = _extract_text(fallback)

    elapsed = round((time.perf_counter() - start) * 1000)

    return {
        "response": raw_text,
        "processing_time_ms": elapsed,
        "model": MODEL_NAME,
    }
