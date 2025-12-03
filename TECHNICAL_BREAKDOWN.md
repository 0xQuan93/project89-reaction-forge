# Technical Breakdown: Reaction Forge

This document provides a technical overview of the Reaction Forge application, including its architecture, dependencies, and key features.

## Project Overview

Reaction Forge is a web-based tool for creating and exporting VRM avatar reactions. It is built with React, Three.js, and Vite, and uses Zustand for state management. The application has two main modes:

*   **Reaction Forge**: The main interface for loading VRM avatars, applying poses and animations, and exporting the results as PNG images or WebM videos.
*   **Pose Lab**: A tool for converting Mixamo FBX animations to a format compatible with Reaction Forge.

## Technology Stack

*   **Frontend Framework**: React 19
*   **3D Rendering**: Three.js
*   **VRM Support**: `@pixiv/three-vrm` and `@pixiv/three-vrm-animation`
*   **State Management**: Zustand
*   **Build Tool**: Vite
*   **Language**: TypeScript
*   **Styling**: CSS Modules

## Project Structure

The project is organized into the following directories:

*   **`src`**: The main source code for the application.
    *   **`components`**: React components, organized by feature.
    *   **`pose-lab`**: Logic for the Pose Lab tool.
    *   **`poses`**: JSON definitions for poses and animations, and the `motionEngine.ts` for procedural animations.
    *   **`state`**: Zustand stores for managing application state.
    *   **`three`**: Core Three.js logic, separated into managers for animations, avatars, backgrounds, and the main scene.
    *   **`utils`**: Utility functions.
    *   **`App.tsx`**: The main React component.
*   **`public`**: Static assets, such as sample VRM files and backgrounds.
*   **`docs`**: Project documentation.
*   **`scripts`**: Scripts for analysis and generation.

## Key Features

### Motion Engine

The Motion Engine is a procedural animation synthesis system that generates natural-looking animations on the fly. It uses a set of bio-mechanical constraints and kinetic lag to simulate realistic body mechanics.

### Reaction Forge

The Reaction Forge is the main interface for creating and exporting VRM avatar reactions. It allows users to:

*   Load custom VRM avatars.
*   Apply pre-made reaction presets.
*   Use custom poses and animations.
*   Control expressions.
*   Choose from a variety of themed backgrounds.
*   Export reactions as PNG images or WebM animations.

### Pose Lab

The Pose Lab is a tool for creating custom poses and animations for use in the Reaction Forge. It allows users to:

*   Retarget Mixamo FBX animations to the VRM format.
*   Preview animations in real-time.
*   Export pose and animation data as JSON files.

## State Management

The application uses Zustand for state management. There are two main stores:

*   **`useAvatarSource`**: Manages the currently loaded VRM avatar.
*   **`useReactionStore`**: Manages the state of the Reaction Forge, including the current pose, animation, expression, and background.

## 3D Rendering

The 3D rendering is handled by Three.js. The core logic is separated into a set of managers in the `src/three` directory:

*   **`animationManager.ts`**: Manages animations.
*   **`avatarManager.ts`**: Manages VRM avatars.
*   **`backgrounds.ts`**: Manages backgrounds.
*   **`sceneManager.ts`**: Manages the main Three.js scene.
