interface MilestoneQuoteProps {
  quote: string;
  show: boolean;
}

export default function MilestoneQuote({ quote, show }: MilestoneQuoteProps) {
  if (!show) return null;

  return (
    <div className="bg-amber-50 rounded-2xl paper-shadow p-8 paper-border animate-fade-in">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-xl font-medium ink-text leading-relaxed">
          "{quote}"
        </p>
      </div>
    </div>
  );
}
