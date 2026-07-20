import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDrag } from '@use-gesture/react';
import { Ring } from '@react-three/drei';

export default function DoorWindow3D({ item, allRooms, allDoors, isSelected, onSelect, onUpdate, setControlsEnabled }) {
  const { id, x, y, width, type, rotation, room_id } = item;

  const { camera } = useThree();
  const [localPos, setLocalPos] = useState({ x, y, rot: rotation });
  const [isOverlapping, setIsOverlapping] = useState(false);

  const checkOverlap = (px, py, prot) => {
    if (!allDoors) return false;
    for (const other of allDoors) {
      if (other.id === id) continue;
      if (other.room_id !== room_id) continue; // Only check overlap with doors in the same room
      
      const isHorizontal = prot === 0 || prot === 180;
      const otherIsHorizontal = other.rotation === 0 || other.rotation === 180;
      
      const hw = width / 2;
      const hwOther = other.width / 2;
      const ht = 0.2; // Thickness threshold
      
      const r1 = {
        left: px - (isHorizontal ? hw : ht),
        right: px + (isHorizontal ? hw : ht),
        top: py - (isHorizontal ? ht : hw),
        bottom: py + (isHorizontal ? ht : hw),
      };
      
      const r2 = {
        left: other.x - (otherIsHorizontal ? hwOther : ht),
        right: other.x + (otherIsHorizontal ? hwOther : ht),
        top: other.y - (otherIsHorizontal ? ht : hwOther),
        bottom: other.y + (otherIsHorizontal ? ht : hwOther),
      };
      
      // If bounding boxes intersect, return true
      if (!(r1.left >= r2.right || r1.right <= r2.left || r1.top >= r2.bottom || r1.bottom <= r2.top)) {
        return true;
      }
    }
    return false;
  };

  useEffect(() => {
    setLocalPos({ x, y, rot: rotation });
  }, [x, y, rotation]);

  const bind = useDrag(({ tap, first, down, movement: [mx, my], memo }) => {
    if (tap) {
      onSelect();
      return memo;
    }
    if (first) {
      memo = { x: localPos.x, y: localPos.y };
    }
    
    const worldDx = mx / camera.zoom;
    const worldDy = my / camera.zoom;
    
    let newX = memo.x + worldDx;
    let newY = memo.y + worldDy;
    let newRot = rotation;

    // Strict Perimeter Snapping to Parent Room (in local coordinates)
    if (allRooms && allRooms.length > 0) {
      const parentRoom = allRooms.find(r => r.id === room_id);
      if (parentRoom) {
        const hw = parentRoom.width / 2;
        const hh = parentRoom.height / 2;
        
        // Coordinates of the 4 edges relative to room center
        const left = -hw;
        const right = hw;
        const top = -hh;    
        const bottom = hh; 
        
        // Distances from proposed position to each edge
        const dTop = Math.abs(newY - top);
        const dBottom = Math.abs(newY - bottom);
        const dLeft = Math.abs(newX - left);
        const dRight = Math.abs(newX - right);
        
        const minD = Math.min(dTop, dBottom, dLeft, dRight);
        const margin = width / 2; // Keep door fully inside the wall segment

        if (minD === dTop) {
          newY = top;
          newX = Math.max(left + margin, Math.min(right - margin, newX));
          newRot = 180;
        } else if (minD === dBottom) {
          newY = bottom;
          newX = Math.max(left + margin, Math.min(right - margin, newX));
          newRot = 0;
        } else if (minD === dLeft) {
          newX = left;
          newY = Math.max(top + margin, Math.min(bottom - margin, newY));
          newRot = -90;
        } else {
          newX = right;
          newY = Math.max(top + margin, Math.min(bottom - margin, newY));
          newRot = 90;
        }
      }
    }

    const overlap = checkOverlap(newX, newY, newRot);
    setIsOverlapping(overlap);
    setLocalPos({ x: newX, y: newY, rot: newRot });

    if (!down) {
      if (overlap) {
        // Revert to original position if dropped on overlap
        setLocalPos({ x: memo.x, y: memo.y, rot: rotation });
        setIsOverlapping(false);
      } else {
        onUpdate(id, { x: newX, y: newY, rotation: newRot });
      }
    }
    
    return memo;
  }, { pointerEvents: true, filterTaps: true });

  const posX = localPos.x;
  const posY = -localPos.y;

  const rotZ = (localPos.rot * Math.PI) / 180;
  
  const bindEvents = bind();
  
  const handlePointerDown = (e) => {
    if (e.button === 0) {
      e.stopPropagation();
      if (setControlsEnabled) setControlsEnabled(false);
    }
    if (bindEvents.onPointerDown) bindEvents.onPointerDown(e);
  };

  const handlePointerUp = (e) => {
    if (e.button === 0) {
      e.stopPropagation();
      if (setControlsEnabled) setControlsEnabled(true);
    }
    if (bindEvents.onPointerUp) bindEvents.onPointerUp(e);
  };

  const isDoor = type === 'door';
  const color = isOverlapping ? '#e53935' : (isSelected ? '#ff9800' : (isDoor ? '#8d6e63' : '#4fc3f7'));

  return (
    <group 
      position={[posX, posY, 0.1]} 
      rotation={[0, 0, rotZ]} 
      {...bindEvents} 
      onPointerDown={handlePointerDown} 
      onPointerUp={handlePointerUp}
    >
      {isDoor ? (
        <group>
          {/* Blueprint Door */}
          {/* Door Panel */}
          <mesh position={[width / 2, width / 2, 0]}>
            <boxGeometry args={[0.1, width, 0.1]} />
            <meshBasicMaterial color={color} />
          </mesh>
          {/* Arc */}
          <Ring args={[width - 0.05, width + 0.05, 32, 1, Math.PI / 2, Math.PI / 2]} position={[width / 2, 0, 0]} rotation={[0, 0, 0]}>
            <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.3} />
          </Ring>
          {/* Empty Space Gap */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[width, 0.3, 0.05]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.0} />
          </mesh>
        </group>
      ) : (
        <group>
          {/* Blueprint Window */}
          {/* Frame outline */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[width, 0.2, 0.1]} />
            <meshBasicMaterial color="#bdbdbd" />
          </mesh>
          {/* Glass */}
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[width - 0.1, 0.05, 0.1]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}
