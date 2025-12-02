"""
Blender Script: Import VRM Pose JSON
Applies VRM pose data to a Blender armature

Usage:
1. Open Blender with your VRM model (or compatible armature)
2. Open Scripting workspace
3. Load this script
4. Update the JSON_PATH and ARMATURE_NAME variables
5. Run the script

Requirements:
- Blender 3.0+
- VRM model imported (or armature with VRM-compatible bone names)
"""

import bpy
import json
import math
from mathutils import Quaternion, Euler

# ============ CONFIGURATION ============
JSON_PATH = "C:/path/to/your/pose.json"  # Update this path
ARMATURE_NAME = "Armature"  # Your armature object name
# =======================================

# VRM bone name to Blender bone name mapping
# Adjust this mapping based on your specific rig
VRM_TO_BLENDER_BONES = {
    # Core
    "hips": "Hips",
    "spine": "Spine",
    "chest": "Chest",
    "upperChest": "UpperChest",
    "neck": "Neck",
    "head": "Head",
    
    # Left Arm
    "leftShoulder": "LeftShoulder",
    "leftUpperArm": "LeftUpperArm",
    "leftLowerArm": "LeftLowerArm",
    "leftHand": "LeftHand",
    
    # Right Arm
    "rightShoulder": "RightShoulder",
    "rightUpperArm": "RightUpperArm",
    "rightLowerArm": "RightLowerArm",
    "rightHand": "RightHand",
    
    # Left Leg
    "leftUpperLeg": "LeftUpperLeg",
    "leftLowerLeg": "LeftLowerLeg",
    "leftFoot": "LeftFoot",
    "leftToes": "LeftToes",
    
    # Right Leg
    "rightUpperLeg": "RightUpperLeg",
    "rightLowerLeg": "RightLowerLeg",
    "rightFoot": "RightFoot",
    "rightToes": "RightToes",
    
    # Fingers (Left)
    "leftThumbProximal": "LeftThumbProximal",
    "leftThumbIntermediate": "LeftThumbIntermediate",
    "leftThumbDistal": "LeftThumbDistal",
    "leftIndexProximal": "LeftIndexProximal",
    "leftIndexIntermediate": "LeftIndexIntermediate",
    "leftIndexDistal": "LeftIndexDistal",
    "leftMiddleProximal": "LeftMiddleProximal",
    "leftMiddleIntermediate": "LeftMiddleIntermediate",
    "leftMiddleDistal": "LeftMiddleDistal",
    "leftRingProximal": "LeftRingProximal",
    "leftRingIntermediate": "LeftRingIntermediate",
    "leftRingDistal": "LeftRingDistal",
    "leftLittleProximal": "LeftLittleProximal",
    "leftLittleIntermediate": "LeftLittleIntermediate",
    "leftLittleDistal": "LeftLittleDistal",
    
    # Fingers (Right)
    "rightThumbProximal": "RightThumbProximal",
    "rightThumbIntermediate": "RightThumbIntermediate",
    "rightThumbDistal": "RightThumbDistal",
    "rightIndexProximal": "RightIndexProximal",
    "rightIndexIntermediate": "RightIndexIntermediate",
    "rightIndexDistal": "RightIndexDistal",
    "rightMiddleProximal": "RightMiddleProximal",
    "rightMiddleIntermediate": "RightMiddleIntermediate",
    "rightMiddleDistal": "RightMiddleDistal",
    "rightRingProximal": "RightRingProximal",
    "rightRingIntermediate": "RightRingIntermediate",
    "rightRingDistal": "RightRingDistal",
    "rightLittleProximal": "RightLittleProximal",
    "rightLittleIntermediate": "RightLittleIntermediate",
    "rightLittleDistal": "RightLittleDistal",
}


def load_vrm_pose_json(filepath):
    """Load VRM pose JSON file"""
    with open(filepath, 'r') as f:
        data = json.load(f)
    return data


def apply_vrm_pose_to_armature(armature_name, pose_data):
    """Apply VRM pose to Blender armature"""
    
    # Get armature object
    armature_obj = bpy.data.objects.get(armature_name)
    if not armature_obj:
        print(f"Error: Armature '{armature_name}' not found!")
        return False
    
    if armature_obj.type != 'ARMATURE':
        print(f"Error: '{armature_name}' is not an armature!")
        return False
    
    # Switch to pose mode
    bpy.context.view_layer.objects.active = armature_obj
    bpy.ops.object.mode_set(mode='POSE')
    
    # Get VRM pose data
    vrm_pose = pose_data.get('vrmPose', {})
    if not vrm_pose:
        print("Error: No vrmPose data found in JSON!")
        return False
    
    applied_count = 0
    skipped_count = 0
    
    # Apply rotations to each bone
    for vrm_bone_name, bone_data in vrm_pose.items():
        # Get Blender bone name
        blender_bone_name = VRM_TO_BLENDER_BONES.get(vrm_bone_name)
        
        if not blender_bone_name:
            print(f"Warning: No mapping for VRM bone '{vrm_bone_name}'")
            skipped_count += 1
            continue
        
        # Get pose bone
        pose_bone = armature_obj.pose.bones.get(blender_bone_name)
        if not pose_bone:
            print(f"Warning: Bone '{blender_bone_name}' not found in armature")
            skipped_count += 1
            continue
        
        # Get rotation quaternion
        rotation = bone_data.get('rotation')
        if not rotation or len(rotation) != 4:
            continue
        
        # VRM uses [x, y, z, w] quaternion format
        quat = Quaternion((rotation[3], rotation[0], rotation[1], rotation[2]))
        
        # Apply rotation
        # Note: You may need to adjust coordinate system conversion here
        pose_bone.rotation_quaternion = quat
        applied_count += 1
    
    print(f"Applied pose to {applied_count} bones")
    print(f"Skipped {skipped_count} bones")
    
    # Update view
    bpy.context.view_layer.update()
    
    return True


def apply_scene_rotation(pose_data):
    """Apply scene rotation to armature"""
    scene_rotation = pose_data.get('sceneRotation', {})
    if not scene_rotation:
        return
    
    armature_obj = bpy.data.objects.get(ARMATURE_NAME)
    if not armature_obj:
        return
    
    # Get rotation in degrees
    x = math.radians(scene_rotation.get('x', 0))
    y = math.radians(scene_rotation.get('y', 0))
    z = math.radians(scene_rotation.get('z', 0))
    
    # Apply to object rotation
    armature_obj.rotation_euler = Euler((x, y, z), 'XYZ')
    print(f"Applied scene rotation: X={scene_rotation.get('x', 0)}°, Y={scene_rotation.get('y', 0)}°, Z={scene_rotation.get('z', 0)}°")


def main():
    """Main execution"""
    print("=" * 50)
    print("VRM Pose Importer for Blender")
    print("=" * 50)
    
    # Load pose data
    print(f"\nLoading pose from: {JSON_PATH}")
    try:
        pose_data = load_vrm_pose_json(JSON_PATH)
        print("✓ Pose data loaded successfully")
    except Exception as e:
        print(f"✗ Error loading pose: {e}")
        return
    
    # Apply scene rotation
    print(f"\nApplying scene rotation...")
    apply_scene_rotation(pose_data)
    
    # Apply pose to armature
    print(f"\nApplying pose to armature '{ARMATURE_NAME}'...")
    success = apply_vrm_pose_to_armature(ARMATURE_NAME, pose_data)
    
    if success:
        print("\n✓ Pose applied successfully!")
        print("\nNext steps:")
        print("1. Adjust the pose as needed")
        print("2. Add keyframes for animation")
        print("3. Export as FBX if desired")
    else:
        print("\n✗ Failed to apply pose")
        print("\nTroubleshooting:")
        print("1. Check that ARMATURE_NAME matches your armature")
        print("2. Verify bone name mappings in VRM_TO_BLENDER_BONES")
        print("3. Ensure VRM model is properly imported")
    
    print("\n" + "=" * 50)


# Run the script
if __name__ == "__main__":
    main()

