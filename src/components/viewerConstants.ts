// Grid and axis rendering constants
export const GRID_LINE_Z_OFFSET = 0.1 // Z offset to render grid lines above XY plane
export const AXIS_LABEL_OFFSET = 5 // Distance from axis end to label (mm)

// Camera configuration
export const CAMERA_HEIGHT_MULTIPLIER = 0.8 // Z position relative to distance
export const CAMERA_DISTANCE_MULTIPLIER = 1.5 // Distance multiplier from model size
export const CAMERA_NEAR_PLANE_RATIO = 0.001 // Near plane as ratio of model size
export const CAMERA_FAR_PLANE_RATIO = 10 // Far plane as multiplier of model size
export const CAMERA_FAR_PLANE_MIN = 2000 // Minimum far plane distance
export const CAMERA_NEAR_PLANE_MIN = 0.1 // Minimum near plane distance

// Controls configuration
export const ZOOM_SPEED = 1.5
export const PAN_SPEED_MIN = 0.5
export const PAN_SPEED_SCALE = 0.02
export const PAN_SPEED_UPDATE_THRESHOLD = 0.01 // 1% distance change threshold

// Lighting
export const AMBIENT_LIGHT_INTENSITY = 0.3
export const DIRECTIONAL_LIGHT_INTENSITY = 0.8
