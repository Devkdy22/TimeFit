import { useMemo, useState } from 'react';
import type { UiStatus } from '../../../theme/status-config';
import { routineItems } from '../../../mocks/route';

export function useRoutineState() {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [isLoginModalOpen, setLoginModalOpen] = useState(false);
  const [isLoggedIn] = useState(false);

  const completedCount = checkedIds.length;
  const allCompleted = completedCount === routineItems.length;

  const status = useMemo<UiStatus>(() => {
    if (allCompleted) {
      return 'relaxed';
    }
    if (completedCount >= 2) {
      return 'warning';
    }
    return 'urgent';
  }, [allCompleted, completedCount]);

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const closeLoginModal = () => {
    setLoginModalOpen(false);
  };

  const handleSaveRoutine = () => {
    if (!isLoggedIn) {
      setLoginModalOpen(true);
      return;
    }
  };

  return {
    routineItems,
    checkedIds,
    completedCount,
    allCompleted,
    status,
    isLoginModalOpen,
    toggleChecked,
    handleSaveRoutine,
    closeLoginModal,
  };
}
