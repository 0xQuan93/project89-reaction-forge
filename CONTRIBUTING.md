# Contributing to Reaction Forge

Thank you for your interest in contributing to Reaction Forge! This document provides guidelines and instructions for contributing.

---

## 🎯 Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest new features
- 📝 Improve documentation
- 🎨 Add new pose presets
- 🔧 Fix issues
- ✨ Implement new features

---

## 🚀 Getting Started

### 1. Fork & Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/reaction-forge.git
cd reaction-forge
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 4. Start Development Server

```bash
npm run dev
```

---

## 📋 Development Guidelines

### Code Style

- **TypeScript**: Use strict typing, avoid `any` when possible
- **React**: Functional components with hooks
- **Naming**: 
  - Components: `PascalCase`
  - Functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
- **Formatting**: Run `npm run format` before committing

### File Organization

```
src/
├── components/     # React UI components
├── three/          # Three.js managers (scene, avatar, animation)
├── state/          # Zustand stores
├── poses/          # Pose definitions & animations
├── utils/          # Utility functions
└── types/          # TypeScript type definitions
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new pose preset "Victory Dance"
fix: resolve animation loop issue in Pose Lab
docs: update README with new features
style: format code with prettier
refactor: simplify avatarManager logic
test: add tests for pose serialization
```

---

## 🎨 Adding New Pose Presets

### 1. Create Pose in Pose Lab

1. Open Pose Lab: http://localhost:5173/?mode=pose-lab
2. Load a VRM avatar
3. Load a Mixamo FBX animation
4. Export both `pose.json` and `pose-animation.json`

### 2. Add Files to Project

```bash
# Add to src/poses/
src/poses/
├── your-pose-name.json           # Static pose
└── your-pose-name-animation.json # Animation (optional)
```

### 3. Register in Code

**src/poses/index.ts**:
```typescript
import yourPoseName from './your-pose-name.json';
import yourPoseNameAnimation from './your-pose-name-animation.json';

export const poseLibrary = {
  // ... existing poses
  'your-pose-name': yourPoseName,
};

export const animationLibrary = {
  // ... existing animations
  'your-pose-name': yourPoseNameAnimation,
};
```

**src/types/reactions.ts**:
```typescript
export type PoseId =
  | 'dawn-runner'
  // ... existing poses
  | 'your-pose-name';
```

**src/data/reactions.ts**:
```typescript
export const reactionPresets: ReactionPreset[] = [
  // ... existing presets
  {
    id: 'your-pose-name',
    label: 'Your Pose Name',
    description: 'A brief description',
    pose: 'your-pose-name',
    expression: 'joy',
    background: 'midnight-circuit',
    animated: true,
    animationMode: 'loop',
  },
];
```

### 4. Test Your Pose

1. Restart dev server
2. Open Reaction Forge
3. Select your new preset
4. Verify it works in all animation modes

---

## 🐛 Reporting Bugs

### Before Reporting

1. Check [existing issues](https://github.com/yourusername/reaction-forge/issues)
2. Try the latest version
3. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. Windows 11]
- Browser: [e.g. Chrome 120]
- Version: [e.g. 1.0.0]

**Additional context**
Any other relevant information.
```

---

## 💡 Suggesting Features

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Additional context**
Any other relevant information, mockups, or examples.
```

---

## 🔧 Pull Request Process

### 1. Ensure Quality

- ✅ Code builds without errors: `npm run build`
- ✅ No TypeScript errors: `npm run type-check`
- ✅ Code is formatted: `npm run format`
- ✅ All features work in both Reaction Forge and Pose Lab

### 2. Update Documentation

- Update README.md if adding features
- Add comments to complex code
- Update CHANGELOG.md

### 3. Submit PR

```markdown
**Description**
Brief description of changes.

**Type of Change**
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

**Testing**
How you tested the changes.

**Screenshots**
If applicable.

**Checklist**
- [ ] Code builds successfully
- [ ] No TypeScript errors
- [ ] Documentation updated
- [ ] Tested in both tools
```

### 4. Review Process

- Maintainers will review your PR
- Address any requested changes
- Once approved, it will be merged

---

## 🎨 Adding Custom Backgrounds

### 1. Create SVG

- Size: 1920x1080 recommended
- Keep file size under 500KB
- Use web-safe colors

### 2. Add to Project

```bash
# Add to public/backgrounds/
public/backgrounds/your-background.svg
```

### 3. Register Background

**src/three/backgrounds.ts**:
```typescript
const backgroundDefinitions: BackgroundDefinition[] = [
  // ... existing backgrounds
  {
    id: 'your-background',
    label: 'Your Background Name',
    color: '#fallback-hex-color',
    image: '/backgrounds/your-background.svg',
  },
];
```

**src/types/reactions.ts**:
```typescript
export type BackgroundId =
  | 'midnight-circuit'
  // ... existing backgrounds
  | 'your-background';
```

---

## 📚 Code Architecture

### Three.js Managers

- **sceneManager**: Handles Three.js scene, camera, lighting, rendering
- **avatarManager**: Loads VRM, applies poses, manages expressions
- **animationManager**: Plays animation clips, manages mixer

### State Management

- **useReactionStore**: Active preset, animation mode, avatar readiness
- **useAvatarSource**: Current VRM URL and source management

### Pose System

- **Static Poses**: JSON with VRM bone rotations
- **Animation Clips**: JSON with keyframe tracks
- **Hybrid System**: Supports both static and animated poses

---

## 🧪 Testing Guidelines

### Manual Testing Checklist

**Reaction Forge:**
- [ ] Load custom VRM
- [ ] Select each preset
- [ ] Test all animation modes (Static/Loop/Once)
- [ ] Export PNG
- [ ] Export WebM
- [ ] Drag & drop custom pose JSON
- [ ] Drag & drop animation JSON

**Pose Lab:**
- [ ] Load custom VRM
- [ ] Load FBX animation
- [ ] Preview animation
- [ ] Test playback controls
- [ ] Export pose JSON
- [ ] Batch export

---

## 📞 Questions?

- Open a [Discussion](https://github.com/0xQuan93/reaction-forge/discussions)
- Check [Documentation](docs/)
- Review [Troubleshooting](TROUBLESHOOTING.md)

---

## 🙏 Thank You!

Your contributions make Reaction Forge better for everyone. We appreciate your time and effort!

---

**Happy creating! 🎭✨**

