import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Gamepad2, Star, Target, Trophy } from "lucide-react";
import * as learningGamesService from "@/services/learningGames.service";
import { GAME_CATALOG, CATEGORY_LABELS, LEVEL_LABELS } from "@/data/games/catalog";
import { GameCategory, GameCatalogEntry, GameLevel } from "@/types/learningGames.types";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { GamePlayerModal } from "./components/games/GamePlayerModal";
import * as Icons from "lucide-react";

const CATEGORIES: GameCategory[] = ["math", "logic", "general"];
const LEVELS: GameLevel[] = ["beginner", "intermediate", "advanced"];

function GameIcon({ name, className }: { name: string; className?: string }) {
  const IconComponent = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Gamepad2;
  return <IconComponent className={className} />;
}

export function PortalLearningGamesPage() {
  const [level, setLevel] = useState<GameLevel>("beginner");
  const [activeGame, setActiveGame] = useState<GameCatalogEntry | null>(null);
  const toast = useToast();

  const profileQuery = useQuery({ queryKey: ["learning-games", "profile"], queryFn: learningGamesService.getProfile });

  function handleEarnedAchievements(count: number) {
    profileQuery.refetch();
    toast.success(count === 1 ? "New achievement unlocked!" : `${count} new achievements unlocked!`);
  }

  const stats = profileQuery.data?.stats;
  const accuracy = stats && stats.questions_answered > 0 ? Math.round((stats.correct_answers / stats.questions_answered) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Gamepad2 size={22} className="text-accent-600 dark:text-accent-400" />
          <h1 className="text-2xl font-semibold text-[var(--ink-primary)]">Learning Games</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">Play, learn, and earn badges across Math, Logic, and General Learning.</p>
      </div>

      {profileQuery.isLoading ? (
        <Spinner label="Loading your progress..." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={Gamepad2} label="Games Played" value={stats?.games_played ?? 0} />
          <StatTile icon={Target} label="Accuracy" value={`${accuracy}%`} />
          <StatTile icon={Flame} label="Day Streak" value={stats?.current_streak ?? 0} />
          <StatTile icon={Trophy} label="Best Score" value={stats?.highest_score ?? 0} />
        </div>
      )}

      {profileQuery.data && profileQuery.data.achievements.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ink-primary)]">Your Badges</h3>
          <div className="flex flex-wrap gap-2">
            {profileQuery.data.achievements.map((a) => (
              <div
                key={a.key}
                title={a.description}
                className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400"
              >
                <Star size={13} className="fill-amber-400 text-amber-400" /> {a.name}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <div className="w-48">
          <Select
            label="Level"
            value={level}
            onChange={(e) => setLevel(e.target.value as GameLevel)}
            options={LEVELS.map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
          />
        </div>
      </div>

      {CATEGORIES.map((category) => (
        <div key={category}>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ink-primary)]">{CATEGORY_LABELS[category]}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {GAME_CATALOG.filter((g) => g.category === category).map((game) => (
              <button
                key={game.key}
                type="button"
                onClick={() => setActiveGame(game)}
                className="group flex flex-col items-start gap-2 rounded-2xl border border-black/[0.06] bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.08] dark:bg-[#17171a]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600 transition-colors group-hover:bg-accent-500 group-hover:text-white dark:text-accent-400">
                  <GameIcon name={game.icon} className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-[var(--ink-primary)]">{game.title}</div>
                  <div className="text-xs text-[var(--ink-muted)]">{game.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      {activeGame && (
        <GamePlayerModal game={activeGame} level={level} onClose={() => setActiveGame(null)} onEarnedAchievements={handleEarnedAchievements} />
      )}
    </motion.div>
  );
}

function StatTile({ icon: Icon, label, value }: { icon: Icons.LucideIcon; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 dark:border-white/[0.08] dark:bg-[#17171a]">
      <Icon size={18} className="text-accent-600 dark:text-accent-400" />
      <div className="mt-2 text-xl font-bold text-[var(--ink-primary)]">{value}</div>
      <div className="text-xs text-[var(--ink-muted)]">{label}</div>
    </div>
  );
}
