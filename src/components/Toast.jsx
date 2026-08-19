import { toastVisible, toastMessage } from '../store/styleStore';
import './Toast.css';

export default function Toast() {
  const visible = toastVisible.value;
  const message = toastMessage.value;

  if (!visible) return null;

  return (
    <div class={`toast ${visible ? 'show' : ''}`}>
      <span class="toast-message">{message}</span>
    </div>
  );
}
