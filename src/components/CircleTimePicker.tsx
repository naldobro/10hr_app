import { useState, useRef, useEffect } from 'react';

interface CircleTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export default function CircleTimePicker({ value, onChange, label }: CircleTimePickerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const [hours, minutes] = value ? value.split(':').map(Number) : [0, 0];

  const handleMouseDown = () => {
    setIsDragging(true);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;

    let angle = Math.atan2(y, x) * (180 / Math.PI);
    angle = angle + 90;
    if (angle < 0) angle += 360;

    let newHours = Math.round(angle / 15);
    if (newHours === 24) newHours = 0;

    onChange(
      `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
    );
  };

  const handleMinuteChange = (newMinutes: number) => {
    onChange(
      `${String(hours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`
    );
  };

  const angle = (hours * 15 - 90) * (Math.PI / 180);
  const radius = 80;
  const handX = 100 + radius * Math.cos(angle);
  const handY = 100 + radius * Math.sin(angle);

  return (
    <div className="flex flex-col items-center gap-4">
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}

      <svg
        ref={svgRef}
        width="200"
        height="200"
        viewBox="0 0 200 200"
        className="cursor-pointer"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseUp}
      >
        <circle cx="100" cy="100" r="95" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="2" />

        {Array.from({ length: 24 }, (_, i) => {
          const angle = (i * 15 - 90) * (Math.PI / 180);
          const x1 = 100 + 85 * Math.cos(angle);
          const y1 = 100 + 85 * Math.sin(angle);
          const x2 = 100 + 75 * Math.cos(angle);
          const y2 = 100 + 75 * Math.sin(angle);

          return (
            <g key={i}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9ca3af" strokeWidth="2" />
              <text
                x={100 + 65 * Math.cos(angle)}
                y={100 + 65 * Math.sin(angle)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fontWeight="600"
                fill="#374151"
              >
                {String(i).padStart(2, '0')}
              </text>
            </g>
          );
        })}

        <circle cx="100" cy="100" r="8" fill="#3b82f6" />

        <line
          x1="100"
          y1="100"
          x2={handX}
          y2={handY}
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
        />

        <circle cx={handX} cy={handY} r="6" fill="#3b82f6" />
      </svg>

      <div className="flex gap-2 items-center">
        <span className="text-2xl font-bold text-gray-900">{String(hours).padStart(2, '0')}</span>
        <span className="text-2xl font-bold text-gray-400">:</span>

        <div className="flex flex-col items-center">
          <button
            onClick={() => handleMinuteChange((minutes + 5) % 60)}
            className="text-gray-500 hover:text-gray-700 font-bold"
          >
            ▲
          </button>
          <span className="text-2xl font-bold text-gray-900 w-8 text-center">
            {String(minutes).padStart(2, '0')}
          </span>
          <button
            onClick={() => handleMinuteChange((minutes - 5 + 60) % 60)}
            className="text-gray-500 hover:text-gray-700 font-bold"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}
