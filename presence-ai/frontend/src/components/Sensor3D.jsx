import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDrag } from '@use-gesture/react';

export default function Sensor3D({ sensor, room, isSelected, onSelect, onUpdate, setControlsEnabled }) {
  const { sensor_id, x, y, fov_angle, heading_angle, max_distance, is_enabled, presence } = sensor;

  if (!is_enabled) return null;

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
        onUpdate(sensor_id, { x: newX, y: newY });
      }
      return { x: newX, y: newY };
    });
  }, { pointerEvents: true });

  const posX = localPos.x;
  const posY = -localPos.y;
  const posZ = 2.0; 

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

  const fovRad = (fov_angle * Math.PI) / 180;
  const headingRad = (heading_angle * Math.PI) / 180;

  const targetX = posX + Math.sin(headingRad);
  const targetY = posY - Math.cos(headingRad);

  const target = new THREE.Object3D();
  target.position.set(targetX, targetY, 0);

  const baseColor = presence ? '#f44336' : '#4caf50';
  const displayColor = isSelected ? '#ff9800' : baseColor;

  return (
    <group position={[posX, posY, posZ]} rotation={[0, 0, rotZ]} {...bindEvents} onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
      {/* Sensor Body */}
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
        <meshStandardMaterial color={displayColor} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* SpotLight for the Radar Cone */}
      <spotLight
        color={displayColor}
        intensity={isSelected ? 40.0 : 25.0}
        angle={fovRad / 2}
        penumbra={0.3}
        distance={max_distance * 1.5}
        target={target}
      />
      
      {/* Light Cone Visualization */}
      <mesh position={[0, 0, -0.1]} lookAt={(x,y,z) => target.position}>
        <cylinderGeometry args={[0.01, Math.tan(fovRad/2) * max_distance, max_distance, 16, 1, true]} />
        <meshBasicMaterial color={baseColor} transparent opacity={presence ? 0.4 : 0.1} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <primitive object={target} />
    </group>
  );
}
