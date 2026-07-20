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

  const trueDragPos = React.useRef({ x, y });

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

    // proposedX/Y are local to the ORIGINAL room
    let proposedX = memo.x + worldDx;
    let proposedY = memo.y + worldDy;

    // Calculate ABSOLUTE position
    let absX = room.x + proposedX;
    let absY = room.y + proposedY;

    // Determine the active room based on absolute position
    let activeRoom = room;
    if (allRooms && allRooms.length > 0) {
      activeRoom = allRooms.find(r => 
        absX >= r.x - r.width/2 && absX <= r.x + r.width/2 &&
        absY >= r.y - r.height/2 && absY <= r.y + r.height/2
      ) || room;
    }

    let finalHeading = localHeading;

    // Apply snapping in ABSOLUTE space
    if (activeRoom) {
      const SNAP_DIST = 0.4;
      const leftEdge = activeRoom.x - activeRoom.width / 2;
      const rightEdge = activeRoom.x + activeRoom.width / 2;
      const topEdge = activeRoom.y - activeRoom.height / 2;
      const bottomEdge = activeRoom.y + activeRoom.height / 2;

      const isWithinX = absX >= leftEdge - SNAP_DIST && absX <= rightEdge + SNAP_DIST;
      const isWithinY = absY >= topEdge - SNAP_DIST && absY <= bottomEdge + SNAP_DIST;

      const distLeft = isWithinY ? Math.abs(absX - leftEdge) : Infinity;
      const distRight = isWithinY ? Math.abs(absX - rightEdge) : Infinity;
      const distTop = isWithinX ? Math.abs(absY - topEdge) : Infinity;
      const distBottom = isWithinX ? Math.abs(absY - bottomEdge) : Infinity;

      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      let snapped = false;
      if (minDist < SNAP_DIST) {
        snapped = true;
        if (minDist === distLeft) {
           absX = leftEdge + 0.1;
           finalHeading = 90;
        } else if (minDist === distRight) {
           absX = rightEdge - 0.1;
           finalHeading = 270;
        } else if (minDist === distTop) {
           absY = topEdge + 0.1;
           finalHeading = 0; 
        } else if (minDist === distBottom) {
           absY = bottomEdge - 0.1;
           finalHeading = 180;
        }
      }

      if (!snapped) {
        // Fine grid snap (10cm) in absolute space
        absX = Math.round(absX * 10) / 10;
        absY = Math.round(absY * 10) / 10;
        setLocalHeading(heading_angle || 0); // Restore to DB state if not snapped
      } else {
        setLocalHeading(finalHeading);
      }
    }

    // Convert back to ORIGINAL room's local space for visual rendering!
    // This is critical because the <group> is still a child of the original room during drag.
    let renderX = absX - room.x;
    let renderY = absY - room.y;
    
    setLocalPos({ x: renderX, y: renderY });

    if (!down) {
      // Convert to local space of the active room for saving
      let finalLocalX = absX - activeRoom.x;
      let finalLocalY = absY - activeRoom.y;

      onUpdate(sensor_id, { 
        x: finalLocalX, 
        y: finalLocalY, 
        room_id: activeRoom.id,
        heading_angle: finalHeading 
      });
    }
    
    return memo;
  }, { pointerEvents: true, filterTaps: true });

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
