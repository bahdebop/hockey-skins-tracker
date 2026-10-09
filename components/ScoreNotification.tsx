'use client';

import { useEffect, useState } from 'react';
import { Target, TrendingUp, TrendingDown, X } from 'lucide-react';

interface Notification {
  id: string;
  playerName: string;
  position: string;
  goals: number;
  skinsChange: number;
  kind?: 'scored' | 'goalie_goal' | 'goal_allowed';
}

interface ScoreNotificationProps {
  notification: Notification | null;
  onClose: () => void;
}

export default function ScoreNotification({ notification, onClose }: ScoreNotificationProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for fade out animation
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  const getPositionLabel = (pos: string) => {
    switch (pos) {
      case 'F': return 'Forward';
      case 'D': return 'Defense';
      case 'G': return 'Goalie';
      default: return pos;
    }
  };

  const getPositionColor = (pos: string) => {
    switch (pos) {
      case 'F': return 'from-blue-500 to-blue-600';
      case 'D': return 'from-purple-500 to-purple-600';
      case 'G': return 'from-red-500 to-red-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div
      className={`fixed top-20 right-4 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'
      }`}
    >
      <div className={`bg-gradient-to-r ${getPositionColor(notification.position)} rounded-lg shadow-2xl p-4 min-w-[300px] max-w-md`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <Target className="w-8 h-8 text-white" />
            <div className="text-white">
              <div className="font-bold text-lg">
                {notification.kind === 'goal_allowed'
                  ? `${notification.playerName} allowed a goal`
                  : notification.kind === 'goalie_goal'
                    ? `${notification.playerName} scored a goalie goal!`
                    : `${notification.playerName} scored!`}
              </div>
              <div className="text-sm opacity-90">
                {getPositionLabel(notification.position)} • {notification.goals} {notification.goals === 1 ? 'goal' : 'goals'}
              </div>
              <div className="flex items-center gap-1 mt-1 font-semibold">
                {notification.skinsChange > 0 ? (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    +{notification.skinsChange} skins
                  </>
                ) : notification.skinsChange < 0 ? (
                  <>
                    <TrendingDown className="w-4 h-4" />
                    {notification.skinsChange} skins
                  </>
                ) : (
                  <span>No skin change</span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              setVisible(false);
              setTimeout(onClose, 300);
            }}
            className="text-white hover:bg-white/20 rounded p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
