export type FieldErrors = Record<string, string>

export function validateRequired(value: string, fieldLabel: string): string | null {
  if (!value.trim()) {
    return `${fieldLabel} is required.`
  }
  return null
}

export function validateMinLength(
  value: string,
  min: number,
  fieldLabel: string,
): string | null {
  const trimmed = value.trim()
  if (trimmed.length < min) {
    return `${fieldLabel} must be at least ${min} characters.`
  }
  return null
}

export function validateMaxLength(
  value: string,
  max: number,
  fieldLabel: string,
): string | null {
  if (value.trim().length > max) {
    return `${fieldLabel} must be at most ${max} characters.`
  }
  return null
}

export function validateProjectName(name: string): string | null {
  return (
    validateRequired(name, 'Project name') ??
    validateMinLength(name, 2, 'Project name') ??
    validateMaxLength(name, 100, 'Project name')
  )
}

export function validateProjectDescription(description: string): string | null {
  if (!description.trim()) return null
  return validateMaxLength(description, 500, 'Description')
}

export function validateTaskTitle(title: string): string | null {
  return (
    validateRequired(title, 'Task title') ??
    validateMinLength(title, 2, 'Task title') ??
    validateMaxLength(title, 200, 'Task title')
  )
}

export function validateInviteCode(code: string): string | null {
  const trimmed = code.trim()
  if (!trimmed) {
    return 'Enter an invite code to join a project.'
  }
  if (trimmed.length < 4 || trimmed.length > 32) {
    return 'Invite code must be between 4 and 32 characters.'
  }
  return null
}

export function validateDueDate(date: string): string | null {
  if (!date) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) {
    return 'Please enter a valid due date.'
  }
  return null
}

export function validateProjectSelection(projectId: string): string | null {
  if (!projectId) {
    return 'Please select a project.'
  }
  return null
}

export function firstFieldError(errors: FieldErrors): string | null {
  const values = Object.values(errors)
  return values.length > 0 ? values[0] : null
}
