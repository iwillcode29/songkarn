import { useEffect } from 'react'

/**
 * Listens for WASD / arrow key presses and writes normalised direction
 * to the provided inputRef ({ dx, dy } in [-1, 1]).
 * Multiple keys held simultaneously compose correctly (e.g. W+D = up-right).
 */
export function useKeyboard(inputRef) {
  useEffect(() => {
    if (!inputRef) return

    const pressed = new Set()

    function update() {
      let dx = 0
      let dy = 0
      if (pressed.has('w') || pressed.has('arrowup')) dy -= 1
      if (pressed.has('s') || pressed.has('arrowdown')) dy += 1
      if (pressed.has('a') || pressed.has('arrowleft')) dx -= 1
      if (pressed.has('d') || pressed.has('arrowright')) dx += 1

      // Normalise diagonal so it's not faster
      const mag = Math.sqrt(dx * dx + dy * dy)
      if (mag > 1) {
        dx /= mag
        dy /= mag
      }

      inputRef.current = { dx, dy }
    }

    function onKeyDown(e) {
      const key = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
        e.preventDefault()
        pressed.add(key)
        update()
      }
    }

    function onKeyUp(e) {
      const key = e.key.toLowerCase()
      pressed.delete(key)
      update()
    }

    // Reset on window blur (e.g. alt-tab)
    function onBlur() {
      pressed.clear()
      update()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [inputRef])
}
