import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDrag } from '@use-gesture/react';

export default function Sensor3D({ sensor, room, isSelected, onSelect, onUpdate, setControlsEnabled }) {
  const { sensor_id, x, y, fov_angle, heading_angle, max_distance, is_enabled, presence } = sensor;

  if (!is_enabled) return null;

  const { camera } = useThree();
  const [localPos, setLocalPos] = useState({ x, y });
  const [localHeading, setLocalHeading] = useState(heading_angle || 0);
  const [target] = useState(() => new THREE.Object3D());

  const dragPosRef = React.useRef({ x, y });

  useEffect(() => {
    dragPosRef.current = { x, y };
    setLocalPos({ x, y });
    setLocalHeading(heading_angle || 0);
  }, [x, y, heading_angle]);

  useEffect(() => {
    target.position.set(0, -1, 0);
  }, [target]);

  const bind = useDrag(({ tap, first, down, movement: [mx, my], memo }) => {
    if (tap) {
      onSelect();
      return memo;
    }
    if (first) {
      memo = { x: dragPosRef.current.x, y: dragPosRef.current.y, heading: localHeading };
    }

    const worldDx = mx / camera.zoom;
    const worldDy = my / camera.zoom;
    
    let proposedX = memo.x + worldDx;
    let proposedY = memo.y + worldDy; 

    let newX = proposedX;
    let newY = proposedY;
    let newHeading = localHeading;

    // Snapping logic
    if (room) {
      const SNAP_DIST = 0.5;
      const rx = room.x;
      const ry = room.y;
      const rw2 = room.width / 2;
      const rh2 = room.height / 2;

      const leftEdge = rx - rw2;
      const rightEdge = rx + rw2;
      const topEdge = ry - rh2;
      const bottomEdge = ry + rh2;

      let snapped = false;

      const distLeft = Math.abs(proposedX - leftEdge);
      const distRight = Math.abs(proposedX - rightEdge);
      const distTop = Math.abs(proposedY - topEdge);
      const distBottom = Math.abs(proposedY - bottomEdge);

      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      if (minDist < SNAP_DIST) {
        snapped = true;
        if (minDist === distLeft) {
           newX = leftEdge + 0.1;
           newHeading = 90;
        } else if (minDist === distRight) {
           newX = rightEdge - 0.1;
           newHeading = 270;
        } else if (minDist === distTop) {
           newY = topEdge + 0.1;
           newHeading = 0; 
        } else if (minDist === distBottom) {
           newY = bottomEdge - 0.1;
           newHeading = 180;
        }
      }

      if (!snapped) {
         newX = Math.round(proposedX * 2) / 2;
         newY = Math.round(proposedY * 2) / 2;
      }
    }

    setLocalPos({ x: newX, y: newY });
    setLocalHeading(newHeading);

    if (!down) {
      dragPosRef.current = { x: proposedX, y: proposedY };
      onUpdate(sensor_id, { x: newX, y: newY, heading_angle: newHeading });
    }
    return memo;
  }, { filterTaps: true });

  const posX = localPos.x;
  const posY = -localPos.y;
  const posZ = 2.0; 

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

  const fovRad = ((fov_angle || 90) * Math.PI) / 180;
  const headingRad = ((localHeading || 0) * Math.PI) / 180;

  const baseColor = presence ? '#f44336' : '#4caf50';
  const displayColor = isSelected ? '#ff9800' : baseColor;

  return (
    <group 
      position={[posX, posY, posZ]} 
      rotation={[0, 0, headingRad]} 
      {...bindEvents} 
      onPointerDown={handlePointerDown} 
      onPointerUp={handlePointerUp}
    >
      {/* Invisible Drag Target to make it easier to click/drag */}
      <mesh>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Half-Moon Sensor Body */}
      <mesh rotation={[Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.2, 32, 1, false, -Math.PI/2, Math.PI]} />
        <meshStandardMaterial color={displayColor} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* SpotLight for the Radar Cone (Subtle Floor Illumination) */}
      <spotLight
        color={displayColor}
        intensity={isSelected ? 40.0 : 25.0}
        angle={fovRad / 2}
        penumbra={0.3}
        distance={max_distance * 1.5}
        target={target}
      />
      <primitive object={target} />
    </group>
  );
}
