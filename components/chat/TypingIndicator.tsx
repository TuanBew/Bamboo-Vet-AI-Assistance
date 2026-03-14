export default function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-white border border-teal-200 shadow-sm rounded-[18px_18px_18px_4px] px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
