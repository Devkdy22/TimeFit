import { LoginRequiredModal } from '../../auth/LoginRequiredModal';
import { useRoutineState } from '../hooks/useRoutineState';
import { RoutineView } from './RoutineView';

export function RoutineScreen() {
  const {
    routineItems,
    checkedIds,
    completedCount,
    allCompleted,
    status,
    isLoginModalOpen,
    toggleChecked,
    handleSaveRoutine,
    closeLoginModal,
  } = useRoutineState();

  return (
    <>
      <RoutineView
        routineItems={routineItems}
        checkedIds={checkedIds}
        completedCount={completedCount}
        allCompleted={allCompleted}
        status={status}
        onToggleChecked={toggleChecked}
        onSaveRoutine={handleSaveRoutine}
      />

      <LoginRequiredModal visible={isLoginModalOpen} onClose={closeLoginModal} />
    </>
  );
}
