from flask import Flask, request, Response, send_from_directory
from calling_agent import signalwire_client
from elevenlabs import VoiceSettings
from elevenlabs.client import ElevenLabs
from flask import jsonify
from dotenv import load_dotenv
from groq import Groq
import time
import os
import uuid
from typing import Optional, Dict
from sales_agent.sales_conversation import SalesConversation

from flask import Flask, request, jsonify, send_from_directory
import os
from flask_cors import CORS
from elevenlabs import ElevenLabs, VoiceSettings
from pathlib import Path

_src_dir = Path(__file__).resolve().parent.parent
load_dotenv(_src_dir / ".env", override=True)
load_dotenv(_src_dir.parent.parent / ".env", override=True)

app = Flask(__name__)

CORS(app, origins=["http://localhost:3000", "http://localhost:3001", "https://ai-sales-automation-front-end.vercel.app"], supports_credentials=True)

# ElevenLabs Conversational AI bridge: exposes an OpenAI-compatible /v1/chat/completions
# endpoint (backed by the LangGraph/Groq sales agent) plus /elevenlabs/session.
from calling_agent.elevenlabs_bridge import register_elevenlabs_routes
register_elevenlabs_routes(app)

from calling_agent.vapi_config import register_vapi_routes
register_vapi_routes(app)




app.static_folder = "calling_agent/static"
sepr = "="*35

# Dictionary to store active call sessions
active_calls: Dict[str, dict] = {}

# =====================================================================
# =====================================================================
# =====================================================================
# Please use the following command to run this file from the root directory
# i.e sales_agent_service/src
# python3 -m calling_agent.main
# given above it the command to run it in development environment
# =====================================================================
# In order to run it in production, please run the following command
# gunicorn calling_agent.main:app --bind 0.0.0.0:8000
# You also need to have a publically exposed URL 
# 1 - start the ngrok server 
# 2 - Expose the port using NGROK 
# 3 - Copy the public URL in the /make_call
# 4 - Initiate the call by hitting that ip address using CURL command or browser
# Example : https://8e6c-39-63-130-153.ngrok-free.app/make_call
# Make sure that you dont forget writing "/make_call" at the end of the URL

# if you want to modify the parameters of the call : 
# https://bdf1-39-46-241-212.ngrok-free.app/make_call?phone_number=%2B92%20320%200435945
# =====================================================================
# =====================================================================
# =====================================================================

# Telephony is handled by SignalWire (Compatibility API). Credentials are read
# inside calling_agent.signalwire_client from these .env vars:
#   SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE_URL, SIGNALWIRE_NUMBER
signalwire_number = signalwire_client.signalwire_number()

eleven_client = ElevenLabs(api_key=os.getenv("eleven_labs_key"))
PUBLIC_URL = os.getenv("PUBLIC_URL")
# PUBLIC_URL = "https://e57c-72-255-21-2.ngrok-free.app"


# print(sepr)
# print("signalwire_number : ", signalwire_number)
# print("eleven_client : ", eleven_client)
# print("PUBLIC_URL : ", PUBLIC_URL)
# print(sepr,"\n")



# =====================================================================
# =====================================================================
# =====================================================================

def delete_file(folder_path: str, file_name: str) -> None:
    file_path = os.path.join(folder_path, file_name)  # Combine folder path and file name
    try:
        if os.path.exists(file_path):  # Check if the file exists
            os.remove(file_path)  # Delete the file
            print(f"File '{file_name}' has been deleted.")
        else:
            print(f"File '{file_name}' does not exist in the folder.")
    except Exception as e:
        print(f"An error occurred while deleting the file: {e}")

def tts(text: str, session_id: str) -> str:
    # Make sure the static directory exists
    os.makedirs("calling_agent/static", exist_ok=True)
    
    # Use session_id to create unique audio files
    audio_filename = f"response_audio_{session_id}.mp3"

    response = eleven_client.text_to_speech.convert(
        voice_id="IKne3meq5aSn9XLyUdCD",
        output_format="mp3_22050_32",
        text=text,
        model_id="eleven_turbo_v2_5",  # use the turbo model for low latency
        voice_settings=VoiceSettings(
            stability=0.0,
            similarity_boost=1.0,
            style=0.0,
            use_speaker_boost=True,
        ),
    )

    # Delete previous audio file if it exists
    delete_file("calling_agent/static", audio_filename)
    audio_file_path = os.path.join('calling_agent/static', audio_filename)
    print(f"Saving audio to (Relative Path): {audio_file_path}")
    print(f"Saving audio to (Absolute Path): {os.path.abspath(audio_file_path)}")  # Print absolute path

    with open(audio_file_path, 'wb') as f:
        for chunk in response:  # Iterate over the generator to write chunks
            f.write(chunk)

    print("voice fetched")

    # Return the public URL to access the audio
    return f"{PUBLIC_URL}/static/{audio_filename}"  # URL path

# =====================================================================
# =====================================================================
# =====================================================================

# Route to initiate a call. Optional in this project: the primary demo is the
# free, browser-based voice agent at /voice-demo (no telephony provider needed).
# If you fully configure SignalWire later, this route places a real outbound call.
@app.route("/make_call")
def make_call():
    # Soft-disabled when SignalWire is not fully configured. We return a friendly
    # JSON payload pointing demoers at the browser flow instead of a stacktrace.
    if not signalwire_client.is_configured():
        return {
            "disabled": True,
            "reason": (
                "Outbound phone calls are intentionally disabled in this demo "
                "(SignalWire/Twilio do not verify Pakistani caller IDs)."
            ),
            "use_instead": "Open the browser voice demo at /voice-demo (free, no telephony required).",
            "to_enable_later": [
                "Set SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, SIGNALWIRE_SPACE_URL, "
                "SIGNALWIRE_NUMBER in backend/sales_agent_service/src/.env",
                "Verify a non-PK caller ID in the SignalWire dashboard "
                "(Phone Numbers -> Verified Caller IDs) or purchase a number.",
            ],
        }, 503

    # Generate a unique session ID fxor this call
    session_id = str(uuid.uuid4())
    print(sepr,"\nNew call Initiated\n",sepr)

    # Get phone number (with fallback default)
    phone_number = request.args.get('phone_number', '+92 320 0435945')
    company_data = request.args.get('company_data', '')
    customer_data = request.args.get('customer_data', '')
    product_info = request.args.get('product_info', '')
    
    # Initialize a new sales bot for this call
    sales_bot = SalesConversation()
    
    # Store the call data and sales bot in the active calls dictionary
    active_calls[session_id] = {
        'sales_bot': sales_bot,
        'company_data': company_data,
        'customer_data': customer_data,
        'product_info': product_info
    }

    # Generate initial greeting
    tmp = "Hello"
    greeting_text = sales_bot.process_message(tmp)
    audio_url = tts(greeting_text, session_id)
    
    # Store the audio URL in the session
    active_calls[session_id]['audio_url'] = audio_url
    
    # Make the call via SignalWire (Compatibility API), passing the session ID.
    try:
        call = signalwire_client.create_call(
            to=phone_number,
            url=f"{PUBLIC_URL}/voice?session_id={session_id}",
            status_callback=f"{PUBLIC_URL}/call_status?session_id={session_id}",
            status_callback_events=['completed', 'busy', 'no-answer', 'failed', 'canceled'],
            status_callback_method='POST',
        )
    except signalwire_client.SignalWireConfigError as e:
        return {"error": str(e)}, 500
    except Exception as e:
        print(f"SignalWire call failed: {e}")
        return {"error": f"Failed to place call: {e}"}, 502

    call_sid = call.get("sid") or call.get("Sid")
    return {
        "message": f"Call initiated with SID: {call_sid}",
        "details": {
            "session_id": session_id,
            "phone_number": phone_number,
            "company_data": company_data,
            "customer_data": customer_data,
            "product_info": product_info
        }
    }


# TwiML route that handles the call
@app.route("/voice", methods=["POST"])
def voice():
    # Get the session ID from the URL parameters
    session_id = request.args.get('session_id')
    
    # Check if the session exists (should always be true for valid calls)
    if session_id not in active_calls:
        # If somehow we get here without a valid session, create a new one
        session_id = str(uuid.uuid4())
        active_calls[session_id] = {
            'sales_bot': SalesConversation(),
            'audio_url': tts("Hello, this is an automated call. What can I help you with today?", session_id)
        }
    
    # Play the audio for this session, then gather speech input.
    xml = signalwire_client.cxml_play_and_gather(
        active_calls[session_id]['audio_url'],
        f"/process_speech?session_id={session_id}",
        timeout="auto",
        speech_timeout="auto",
    )
    return Response(xml, mimetype="application/xml")


# Route to process speech input
@app.route("/process_speech", methods=["POST"])
def process_speech():
    # Get the session ID from the URL parameters
    session_id = request.args.get('session_id')
    print("Entered process_Speech")
    
    # If the session doesn't exist, return an error message
    if session_id not in active_calls:
        xml = signalwire_client.cxml_say_hangup(
            "Sorry, there was an error with your call. Please try again."
        )
        return Response(xml, mimetype="application/xml")

    speech_result = request.form.get('SpeechResult', '')
    print(f"Session {session_id} - Speech Result: {speech_result}")
    
    # Get the response from this session's sales bot
    sales_bot = active_calls[session_id]['sales_bot']
    answer = sales_bot.process_message(speech_result)
    
    # Generate audio response with ElevenLabs
    audio_url = tts(answer, session_id)
    
    # Update the audio URL for this session
    active_calls[session_id]['audio_url'] = audio_url

    # Play the reply, then gather the next turn.
    xml = signalwire_client.cxml_play_and_gather(
        audio_url,
        f"/process_speech?session_id={session_id}",
        timeout="3",
        speech_timeout="auto",
    )
    print(sepr, "Response", sepr)
    return Response(xml, mimetype="application/xml")


# Route to handle call status updates
@app.route("/call_status", methods=["POST"])
def call_status():
    # Get the session ID and call status from the request
    session_id = request.form.get('session_id')
    call_status = request.form.get('CallStatus')
    call_sid = request.form.get('CallSid')
    
    print(f"Call status update: {call_status} for session {session_id}, Call SID: {call_sid}")

    # If the call is completed or failed, clean up the session
    if call_status in ['completed', 'failed', 'busy', 'no-answer', 'canceled']:
        if session_id in active_calls:
            # Log the disconnection immediately
            print(f"⚠️ Call disconnected: {call_status} for session {session_id}, Call SID: {call_sid}")

            try:
                audio_filename = f"response_audio_{session_id}.mp3"
                delete_file("calling_agent/static", audio_filename)
            except Exception as e:
                print(f"Error cleaning up files: {e}")
            
            del active_calls[session_id]
            print(f"Cleaned up session {session_id}")
    
    return "OK"


# Route to serve audio files
@app.route("/static/<filename>")
def get_audio(filename):
    return send_from_directory('static', filename)


@app.route("/return_demo_api")
def demo_api():
    time.sleep(6)
    conversation = {
        "messages": [
            {
                "sender": "AI Chatbot",
                "message": "Hello! I noticed your restaurant is doing great. Have you considered using AI to automate customer reservations and feedback management?"
            },
            {
                "sender": "Restaurant Owner",
                "message": "Hey! We've been managing things manually so far. Not sure if AI is really needed for us."
            },
            {
                "sender": "AI Chatbot",
                "message": "I get that! But imagine freeing up your staff's time by letting AI handle repetitive tasks like answering FAQs and managing bookings. It can even send personalized offers to your customers!"
            },
            {
                "sender": "Restaurant Owner",
                "message": "That sounds interesting, but I'm worried about the cost. We're a small business and have a tight budget."
            },
            {
                "sender": "AI Chatbot",
                "message": "Totally understandable! Our service is affordable, and it actually helps increase revenue by improving customer retention. Plus, we offer a free trial so you can see the impact before committing!"
            },
            {
                "sender": "Restaurant Owner",
                "message": "A free trial sounds good! How does the setup work, and how long does it take?"
            }
        ]
    }
    


    ## Define the action
    action = "schedule_demo1"

    
    # Combine the data
    response_data = {
        "action": action,
        "conversation": conversation
    }
    
    # Return the JSON response
    return jsonify(response_data)


# =================================================================
# =================================================================
# =================================================================
# =================================================================
# =================================================================
# =================================================================
# =================================================================
# =================================================================
# =================================================================
# =================================================================
# =================================================================



@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory('calling_agent/static', filename)

# Initialize Eleven Labs client and sales bot
eleven_client = ElevenLabs(api_key=os.getenv("eleven_labs_key"))
sales_bot = SalesConversation()

# Placeholder variables
user_info = {
    "name": "",
    "email": "",
    "phone": "",
    "product": "",
    "description": "",
}
transcription_text = ""
response_text = ""

sepr = "\n===============================================\n"

@app.route("/post-user-info", methods=["POST"])
def submit_info():
    print("\nRUNNING - /post-user-info")
    data = request.json

    user_info["name"] = data.get("name", "")
    user_info["email"] = data.get("email", "")
    user_info["phone"] = data.get("phone", "")
    user_info["product"] = data.get("product", "")
    user_info["description"] = data.get("description", "")

    print(f"Received Info:\nName: {user_info['name']}\nPhone: {user_info['phone']}\nProduct: {user_info['product']}\nDescription: {user_info['description']}")
    return jsonify({"message": "Received Successfully"})

@app.route("/get-user-info", methods=["GET"])
def get_user_info():
    print("\nRUNNING - /get-user-info")
    print(f"{sepr} Sending user info to frontend {sepr}")
    return jsonify({
        "name": user_info["name"],
        "phone": user_info["phone"],
        "product": user_info["product"],
        "description": user_info["description"]
    })

@app.route("/get-ai-response", methods=["GET"])
def get_ai_response():
    print("\nRUNNING - /get-ai-response")
    print(f"{sepr} Sending AI response to frontend {sepr}")
    return jsonify({"text": response_text})

@app.route("/transcribe-audio", methods=["POST"])
def transcribe_audio():
    """Transcribe browser-recorded audio via Groq Whisper (no Google Speech API)."""
    if "audio" not in request.files:
        return jsonify({"detail": "No audio file provided"}), 400

    audio = request.files["audio"]
    audio_bytes = audio.read()
    if not audio_bytes:
        return jsonify({"detail": "Empty audio file"}), 400

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return jsonify({"detail": "GROQ_API_KEY is not configured"}), 500

    filename = audio.filename or "recording.webm"
    try:
        client = Groq(api_key=api_key)
        result = client.audio.transcriptions.create(
            file=(filename, audio_bytes),
            model="whisper-large-v3-turbo",
            response_format="json",
        )
        text = (result.text or "").strip()
        if not text:
            return jsonify({"detail": "Could not detect speech in the recording"}), 400
        return jsonify({"text": text})
    except Exception as e:
        print(f"Whisper transcription error: {e}")
        return jsonify({"detail": str(e)}), 500


@app.route("/transcription", methods=["POST"])
def transcription():
    global transcription_text, response_text

    print("\nRUNNING - /transcription")
    data = request.json
    transcription_text = data.get("text", "")

    print(sepr, "Received Transcription:", transcription_text, sepr)

    response_text = sales_bot.process_message(transcription_text) if sales_bot else "Bot response placeholder"
    audio_path = tts1(response_text)

    return jsonify({
        "message": response_text,
        "audio_url": "http://127.0.0.1:8000/static/response_audio.mp3"
    })

def delete_file(folder_path: str, file_name: str) -> None:
    file_path = os.path.join(folder_path, file_name)
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            print(f"File '{file_name}' has been deleted.")
        else:
            print(f"File '{file_name}' does not exist in the folder.")
    except Exception as e:
        print(f"An error occurred while deleting the file: {e}")

def tts1(text: str) -> str:
    response = eleven_client.text_to_speech.convert(
        voice_id="IKne3meq5aSn9XLyUdCD",
        output_format="mp3_22050_32",
        text=text,
        model_id="eleven_turbo_v2_5",
        voice_settings=VoiceSettings(
            stability=0.0,
            similarity_boost=1.0,
            style=0.0,
            use_speaker_boost=True,
        ),
    )

    delete_file("calling_agent/static", "response_audio.mp3")

    audio_file_path = os.path.join('calling_agent/static', 'response_audio.mp3')
    with open(audio_file_path, 'wb') as f:
        for chunk in response:
            f.write(chunk)

    print("voice fetched")
    return audio_file_path



if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    app.run(host="0.0.0.0", port=port, debug=False)