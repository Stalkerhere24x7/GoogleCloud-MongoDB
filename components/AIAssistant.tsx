
import React from 'react';
import { AQIData, ChatMessage, MessageSender, GroundingChunk } from '../types';
import { AI_ASSISTANT_PROMPTS } from '../constants';
import Card from './common/Card';
import Button from './common/Button';

interface AIAssistantProps {
  aqiData: AQIData | null;
  chatHistory: ChatMessage[];
  onAskAI: (question: string, contextAwarePrompt: string) => void;
  isLoading: boolean;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ aqiData, chatHistory, onAskAI, isLoading }) => {

  const handlePromptClick = (promptText: string, buttonText: string) => {
    let context = "You are a helpful environmental and health advisor. ";
    if (aqiData && aqiData.isValid) {
      context += `Current air quality data for ${aqiData.city} is: AQI ${aqiData.overallAqi} (${aqiData.aqiCategoryName}) with ${aqiData.dominantPollutant} as the dominant pollutant. PM2.5 level is approximately ${aqiData.pollutants['pm25']?.toFixed(1) || 'N/A'} µg/m³. `;
    } else {
      context += "You do not have specific real-time air quality data, so provide general advice. ";
    }
    const fullPrompt = `${context}\n\nBased on this, answer the user's question clearly and concisely:\n\nUser Question: "${promptText}"`;
    onAskAI(buttonText, fullPrompt); // Pass buttonText as the "question" for display purposes
  };
  
  const getSenderStyle = (sender: MessageSender) => {
    switch(sender) {
      case MessageSender.User: return "text-blue-700 font-semibold";
      case MessageSender.AI: return "text-slate-800";
      case MessageSender.System: return "text-slate-500 italic text-sm";
      default: return "";
    }
  };

  return (
    <Card title="AI Assistant" className="flex flex-col flex-grow min-h-[300px]">
      <div className="flex-grow bg-slate-50 p-3 rounded-md mb-4 overflow-y-auto custom-scrollbar h-48 md:h-64 lg:h-80">
        {chatHistory.length === 0 && (
          <p className={`${getSenderStyle(MessageSender.System)}`}>
            {aqiData && aqiData.isValid ? `AQI data loaded for ${aqiData.city}. AQI is ${aqiData.overallAqi} (${aqiData.aqiCategoryName}). Select a prompt for advice.` : "AI Assistant is ready. Fetch AQI data or ask a general question using prompts."}
          </p>
        )}
        {chatHistory.map((msg) => (
          <div key={msg.id} className="mb-3">
            <p className={`${getSenderStyle(msg.sender)}`}>
              {msg.sender === MessageSender.User ? `You: ${msg.text}` : msg.sender === MessageSender.AI ? `AI: ${msg.text}` : msg.text}
            </p>
             {msg.sender === MessageSender.AI && msg.text.includes("Grounding sources:") && (
              <div className="mt-1 text-xs text-gray-500">
                {msg.text.split("Grounding sources:")[1].split(';').map(source => source.trim()).filter(Boolean).map((src, idx) => {
                  const parts = src.split(' (');
                  const title = parts[0];
                  const url = parts[1]?.slice(0, -1); // remove trailing ')'
                  if (url && title) {
                    return <div key={idx}><a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{title}</a></div>;
                  }
                  return null;
                })}
              </div>
            )}
            <p className="text-xs text-slate-400">{new Date(msg.timestamp).toLocaleTimeString()}</p>
          </div>
        ))}
         {isLoading && chatHistory.length > 0 && chatHistory[chatHistory.length-1].sender === MessageSender.User && (
            <div className="mb-3">
                 <p className={`${getSenderStyle(MessageSender.System)}`}>AI is thinking...</p>
            </div>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {AI_ASSISTANT_PROMPTS.map(({ buttonText, promptText }) => (
          <Button
            key={buttonText}
            variant="outline-secondary"
            size="sm"
            onClick={() => handlePromptClick(promptText, buttonText)}
            disabled={isLoading}
            className="w-full text-left justify-start"
          >
            {buttonText}
          </Button>
        ))}
      </div>
    </Card>
  );
};

export default AIAssistant;
