// src/hooks/useUndoRedo.js
import { ref, onMounted, onUnmounted } from 'vue';

export function useUndoRedo() {
  const undoStack = ref([]);
  const redoStack = ref([]);

  const handleKeydown = (event) => {
    if (event.ctrlKey && event.key === 'z') {
      console.log('Ctrl+Z pressed');
      event.preventDefault(); // 阻止默认行为
      undo();
    } else if (event.ctrlKey && event.shiftKey && event.key === 'z') {
      console.log('Ctrl+Shift+Z pressed');
      event.preventDefault(); // 阻止默认行为
      redo();
    }
  };

  const undo = () => {
    if (undoStack.value.length === 0) return;

    const lastAction = undoStack.value.pop();
    redoStack.value.push(lastAction);

    // 执行撤销操作
    if (lastAction.type === 'add') {
      lastAction.undo();
    } else if (lastAction.type === 'remove') {
      lastAction.undo();
    } else if (lastAction.type === 'move') {
      lastAction.undo();
    }
  };

  const redo = () => {
    if (redoStack.value.length === 0) return;

    const lastAction = redoStack.value.pop();
    undoStack.value.push(lastAction);

    // 执行重做操作
    if (lastAction.type === 'add') {
      lastAction.redo();
    } else if (lastAction.type === 'remove') {
      lastAction.redo();
    } else if (lastAction.type === 'move') {
      lastAction.redo();
    }
  };

  const addAction = (action) => {
    undoStack.value.push(action);
    redoStack.value.length = 0; // 清空重做栈
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeydown);
  });

  return {
    addAction,
    undo,
    redo,
  };
}