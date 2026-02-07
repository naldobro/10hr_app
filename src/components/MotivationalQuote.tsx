interface MotivationalQuoteProps {
  workedHours: number;
}

export default function MotivationalQuote({ workedHours }: MotivationalQuoteProps) {
  const getQuote = () => {
    if (workedHours === 0) {
      const startQuotes = [
        "The way to get started is to quit talking and begin doing. — Walt Disney",
        "Do not wait; the time will never be 'just right.' Start where you stand. — Napoleon Hill",
        "You don't have to be great to start, but you have to start to be great. — Zig Ziglar",
        "The secret of getting ahead is getting started. — Mark Twain",
        "Action is the foundational key to all success. — Pablo Picasso",
        "A year from now you may wish you had started today. — Karen Lamb",
      ];
      return startQuotes[Math.floor(Math.random() * startQuotes.length)];
    } else if (workedHours < 2) {
      const earlyQuotes = [
        "The only way to do great work is to love what you do. — Steve Jobs",
        "I fear not the man who has practiced 10,000 kicks once, but I fear the man who has practiced one kick 10,000 times. — Bruce Lee",
        "Success is not final, failure is not fatal: it is the courage to continue that counts. — Winston Churchill",
        "The difference between try and triumph is just a little umph! — Marvin Phillips",
        "Don't stop when you're tired. Stop when you're done. — David Goggins",
      ];
      return earlyQuotes[Math.floor(Math.random() * earlyQuotes.length)];
    } else if (workedHours < 5) {
      const midQuotes = [
        "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.' — Muhammad Ali",
        "The fight is won or lost far away from witnesses - behind the lines, in the gym, and out there on the road, long before I dance under those lights. — Muhammad Ali",
        "Hard work beats talent when talent doesn't work hard. — Tim Notke",
        "Success isn't always about greatness. It's about consistency. Consistent hard work leads to success. — Dwayne Johnson",
        "There are no traffic jams along the extra mile. — Roger Staubach",
        "Obstacles don't have to stop you. If you run into a wall, don't turn around and give up. Figure out how to climb it. — Michael Jordan",
      ];
      return midQuotes[Math.floor(Math.random() * midQuotes.length)];
    } else if (workedHours < 8) {
      const advancedQuotes = [
        "I've failed over and over again in my life. And that is why I succeed. — Michael Jordan",
        "The only place where success comes before work is in the dictionary. — Vidal Sassoon",
        "Everything negative - pressure, challenges - is all an opportunity for me to rise. — Kobe Bryant",
        "If you really want to do something, you'll find a way. If you don't, you'll find an excuse. — Jim Rohn",
        "Work like there is someone working 24 hours a day to take it all away from you. — Mark Cuban",
        "Great things come from hard work and perseverance. No excuses. — Kobe Bryant",
      ];
      return advancedQuotes[Math.floor(Math.random() * advancedQuotes.length)];
    } else if (workedHours < 10) {
      const pushQuotes = [
        "The last three or four reps is what makes the muscle grow. This area of pain divides a champion from someone who is not a champion. — Arnold Schwarzenegger",
        "When you want to succeed as bad as you want to breathe, then you'll be successful. — Eric Thomas",
        "Strength does not come from winning. Your struggles develop your strengths. — Arnold Schwarzenegger",
        "Pain is temporary. Quitting lasts forever. — Lance Armstrong",
        "What hurts today makes you stronger tomorrow. — Jay Cutler",
        "Most people give up just when they're about to achieve success. They quit on the one yard line. — Ross Perot",
      ];
      return pushQuotes[Math.floor(Math.random() * pushQuotes.length)];
    } else {
      const legendQuotes = [
        "Champions aren't made in the gyms. Champions are made from something they have deep inside them - a desire, a dream, a vision. — Muhammad Ali",
        "The more difficult the victory, the greater the happiness in winning. — Pelé",
        "Excellence is not a singular act but a habit. You are what you repeatedly do. — Aristotle",
        "I don't count my sit-ups. I only start counting once it starts hurting. That is when I start counting, because then it really counts. — Muhammad Ali",
        "Impossible is just a big word thrown around by small men who find it easier to live in the world they've been given than to explore the power they have to change it. — Muhammad Ali",
        "The will must be stronger than the skill. — Muhammad Ali",
      ];
      return legendQuotes[Math.floor(Math.random() * legendQuotes.length)];
    }
  };

  return (
    <div className="bg-amber-50/50 rounded-2xl paper-shadow p-8 paper-border">
      <div className="max-w-3xl mx-auto text-center">
        <p className="text-lg ink-text leading-relaxed">
          {getQuote()}
        </p>
      </div>
    </div>
  );
}
