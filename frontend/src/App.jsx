import React from 'react'
import AudioRecorder from './components/AudioRecorder'

function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight mb-2">
          Ata Inteligente <span className="text-blue-600">PWA</span>
        </h1>
        <p className="text-gray-500">Grave sua reunião com segurança</p>
      </div>

      <AudioRecorder />
    </div>
  )
}

export default App
