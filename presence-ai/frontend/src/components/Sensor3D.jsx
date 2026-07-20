import React, { useState, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useDrag } from '@use-gesture/react';

export default function Sensor3D({ sensor, room, allRooms, isSelected, onSelect, onUpdate, setControlsEnabled }) {
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
    
    // proposedX and proposedY are local to the *initial* room of the drag
    const localProposedX = memo.x + worldDx;
    const localProposedY = memo.y + worldDy; 

    // Convert to absolute world coordinates to find if we dropped in another room
    const absX = room.x + localProposedX;
    const absY = room.y + localProposedY;

    // Determine the active room
    let activeRoom = room;
    if (allRooms && allRooms.length > 0) {
      activeRoom = allRooms.find(r => 
        absX >= r.x - r.width/2 && absX <= r.x + r.width/2 &&
        absY >= r.y - r.height/2 && absY <= r.y + r.height/2
      ) || room;
    }

    // Convert back to local coordinates relative to the new activeRoom
    let newX = absX - activeRoom.x;
    let newY = absY - activeRoom.y;
    let newHeading = memo.heading;

    if (activeRoom) {
      const SNAP_DIST = 0.5;
      const rw2 = activeRoom.width / 2;
      const rh2 = activeRoom.height / 2;

      const leftEdge = -rw2;
      const rightEdge = rw2;
      const topEdge = -rh2;
      const bottomEdge = rh2;

      let snapped = false;

      const isWithinX = newX >= leftEdge - SNAP_DIST && newX <= rightEdge + SNAP_DIST;
      const isWithinY = newY >= topEdge - SNAP_DIST && newY <= bottomEdge + SNAP_DIST;

      const distLeft = isWithinY ? Math.abs(newX - leftEdge) : Infinity;
      const distRight = isWithinY ? Math.abs(newX - rightEdge) : Infinity;
      const distTop = isWithinX ? Math.abs(newY - topEdge) : Infinity;
      const distBottom = isWithinX ? Math.abs(newY - bottomEdge) : Infinity;

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
         newX = Math.round(newX * 2) / 2;
         newY = Math.round(newY * 2) / 2;
      }
    }

    setLocalPos({ x: newX, y: newY });
    setLocalHeading(newHeading);

    if (!down) {
      // Upon drop, if we changed room, memo is no longer valid, but the user must start a new drag anyway
      onUpdate(sensor_id, { x: newX, y: newY, heading_angle: newHeading, room_id: activeRoom.id });
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
