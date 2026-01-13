'use client';

import { Bot, X } from 'lucide-react';

export default function AIFloatingButton({ onClick, isOpen }) {
    if (isOpen) return null;

    return (
        <button
            onClick={onClick}
            className="group flex items-center justify-center transition-all duration-300 hover:scale-110"
            style={{
                position: 'fixed',
                bottom: '96px', // 24px (search) + 56px (height) + 16px (gap)
                right: '24px',
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                zIndex: 210, // Higher than AIChatWindow (200)
                border: '2px solid #000000',
                cursor: 'pointer'
            }}
        >
            {isOpen ? (
                <X size={28} color="#000000" className="animate-in fade-in zoom-in duration-200" />
            ) : (
                <Bot size={28} color="#000000" className="group-hover:rotate-12 transition-transform animate-in fade-in zoom-in duration-200" />
            )}
        </button>
    );
}
