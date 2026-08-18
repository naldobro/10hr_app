interface MilestoneQuoteProps {
  quote: string;
  show: boolean;
}

export default function MilestoneQuote({ quote, show }: MilestoneQuoteProps) {
  if (!show) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-400/10 rounded-2xl paper-shadow p-4 sm:p-6 lg:p-8 paper-border animate-fade-in">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-base sm:text-lg lg:text-xl font-medium ink-text leading-relaxed">
          &ldquo;{quote}&rdquo;
        </p>
      </div>
    </div>
  );
}
