import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDrag } from '@use-gesture/react';
import { Ring } from '@react-three/drei';

export default function DoorWindow3D({ item, isSelected, onSelect, onUpdate, setControlsEnabled }) {
  const { id, x, y, width, type, rotation } = item;

  const { camera } = useThree();
  const [localPos, setLocalPos] = useState({ x, y });

  useEffect(() => {
    setLocalPos({ x, y });
  }, [x, y]);

  const bind = useDrag(({ down, delta: [dx, dy] }) => {

    const worldDx = dx / camera.zoom;
    const worldDy = dy / camera.zoom;
    
    setLocalPos((prev) => {
      const newX = prev.x + worldDx;
      const newY = prev.y + worldDy; 
      if (!down) {
        onUpdate(id, { x: newX, y: newY });
      }
      return { x: newX, y: newY };
    });
  }, { pointerEvents: true });

  const posX = localPos.x;
  const posY = -localPos.y;

  const rotZ = (rotation * Math.PI) / 180;
  
  const bindEvents = bind();
  
  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (setControlsEnabled) setControlsEnabled(false);
    onSelect();
    if (bindEvents.onPointerDown) bindEvents.onPointerDown(e);
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();
    if (setControlsEnabled) setControlsEnabled(true);
    if (bindEvents.onPointerUp) bindEvents.onPointerUp(e);
  };

  const isDoor = type === 'door';
  const color = isSelected ? '#ff9800' : (isDoor ? '#8d6e63' : '#4fc3f7');

  return (
    <group position={[posX, posY, 0.1]} rotation={[0, 0, rotZ]} {...bindEvents} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      {isDoor ? (
        <group>
          {/* Blueprint Door */}
          {/* Door Panel */}
          <mesh position={[width / 2, width / 2, 0]}>
            <boxGeometry args={[0.1, width, 0.1]} />
            <meshBasicMaterial color={color} />
          </mesh>
          {/* Arc */}
          <Ring args={[width - 0.05, width + 0.05, 32, 1, 0, Math.PI / 2]} position={[width / 2, 0, 0]} rotation={[0, 0, 0]}>
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
