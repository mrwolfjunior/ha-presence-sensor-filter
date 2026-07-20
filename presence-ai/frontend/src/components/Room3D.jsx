import React, { useState, useEffect, useRef } from 'react';
import { useCursor, Text } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/three';
import * as THREE from 'three';

const WALL_THICKNESS = 0.2;
const WALL_HEIGHT = 2.5;

export default function Room3D({ room, allRooms = [], allDoors = [], isSelected, onSelect, onUpdate, onDelete, setControlsEnabled, children }) {
  const { x, y, width, height, name } = room;
  
  const [hovered, setHovered] = useState(false);
  const [isOverlapping, setIsOverlapping] = useState(false);
  useCursor(hovered);

  const { camera } = useThree();
  
  // Usiamo useSpring per avere transizioni morbide su posizione e colore
  const [{ pos, wallColor, floorColor, textColor }, api] = useSpring(() => ({ 
    pos: [x, -y, 0], 
    wallColor: isSelected ? '#ff9800' : '#4fc3f7',
    floorColor: isSelected ? '#e3f2fd' : '#fafafa',
    textColor: '#333333',
    config: { mass: 1, tension: 500, friction: 30 } 
  }));

  // Manteniamo una ref per la posizione reale (senza snapping/overlap)
  const dragPosRef = useRef({ x, y });

  useEffect(() => {
    // Sincronizza lo stato di selezione con il colore
    const targetWall = isOverlapping ? '#bdbdbd' : (isSelected ? '#ff9800' : '#4fc3f7');
    const targetFloor = isOverlapping ? '#e0e0e0' : (hovered ? '#f5f5f5' : (isSelected ? '#e3f2fd' : '#fafafa'));
    const targetText = isOverlapping ? '#9e9e9e' : '#333333';
    
    api.start({ 
      wallColor: targetWall, 
      floorColor: targetFloor, 
      textColor: targetText,
      immediate: false 
    });
  }, [isSelected, hovered, isOverlapping, api]);

  useEffect(() => {
    // Quando le coordinate del DB cambiano (es. caricamento o update completato)
    if (!isOverlapping) {
      dragPosRef.current = { x, y };
      api.start({ pos: [x, -y, 0], immediate: false });
    }
  }, [x, y, api, isOverlapping]);

  const checkOverlap = (rx, ry) => {
    const r1 = {
      left: rx - width / 2,
      right: rx + width / 2,
      top: ry - height / 2,
      bottom: ry + height / 2,
    };
    for (const other of allRooms) {
      if (other.id === room.id) continue;
      const r2 = {
        left: other.x - other.width / 2,
        right: other.x + other.width / 2,
        top: other.y - other.height / 2,
        bottom: other.y + other.height / 2,
      };
      // 0.05m di tolleranza per permettere di affiancarle perfettamente
      if (
        Math.max(r1.left, r2.left) + 0.05 < Math.min(r1.right, r2.right) &&
        Math.max(r1.top, r2.top) + 0.05 < Math.min(r1.bottom, r2.bottom)
      ) {
        return true;
      }
    }
    return false;
  };

  const getSnappedPosition = (proposedX, proposedY) => {
    const snapThreshold = 0.5; // mezzo metro di calamita
    let newX = proposedX;
    let newY = proposedY;
    
    // Test Snap Orizzontale (X)
    let minXDist = snapThreshold;
    for (const other of allRooms) {
      if (other.id === room.id) continue;
      const snapPoints = [
        other.x - other.width / 2 - width / 2, // attaccato a sx
        other.x + other.width / 2 + width / 2, // attaccato a dx
        other.x - other.width / 2 + width / 2, // allineato a sx
        other.x + other.width / 2 - width / 2, // allineato a dx
        other.x // allineato al centro
      ];
      for (const sp of snapPoints) {
        const dist = Math.abs(sp - proposedX);
        if (dist < minXDist) {
          minXDist = dist;
          newX = sp;
        }
      }
    }

    // Test Snap Verticale (Y)
    let minYDist = snapThreshold;
    for (const other of allRooms) {
      if (other.id === room.id) continue;
      const snapPoints = [
        other.y - other.height / 2 - height / 2, // attaccato sopra
        other.y + other.height / 2 + height / 2, // attaccato sotto
        other.y - other.height / 2 + height / 2, // allineato sopra
        other.y + other.height / 2 - height / 2, // allineato sotto
        other.y // allineato al centro
      ];
      for (const sp of snapPoints) {
        const dist = Math.abs(sp - proposedY);
        if (dist < minYDist) {
          minYDist = dist;
          newY = sp;
        }
      }
    }

    return { x: newX, y: newY };
  };

  const bind = useDrag(({ tap, first, down, movement: [mx, my], memo }) => {
    if (tap) {
      onSelect();
      return memo;
    }
    if (first) {
      memo = { x: dragPosRef.current.x, y: dragPosRef.current.y };
    }
    
    const worldDx = mx / camera.zoom;
    const worldDy = my / camera.zoom;
    
    // Posizione pura basata sul movimento del mouse
    let proposedX = memo.x + worldDx;
    let proposedY = memo.y + worldDy;
    
    // Calcoliamo lo snap
    const snapped = getSnappedPosition(proposedX, proposedY);
    proposedX = snapped.x;
    proposedY = snapped.y;

    // Verifichiamo se c'è sovrapposizione dopo lo snap
    const overlap = checkOverlap(proposedX, proposedY);
    setIsOverlapping(overlap);

    if (!down) {
      // Rilascio del mouse
      if (overlap) {
        // Posizione non valida: animiamo indietro senza salvare
        const origX = memo.x;
        const origY = memo.y;
        dragPosRef.current = { x: origX, y: origY };
        setIsOverlapping(false);
        api.start({ pos: [origX, -origY, 0], immediate: false });
      } else {
        // Posizione valida: salviamo e confermiamo (animazione completata)
        dragPosRef.current = { x: proposedX, y: proposedY };
        api.start({ pos: [proposedX, -proposedY, 0], immediate: false });
        onUpdate(room.id, { x: proposedX, y: proposedY });
      }
    } else {
      // Mentre si sta trascinando, alziamo la stanza sull'asse Z (es. z=3) per farla passare sopra le altre
      api.start({ pos: [proposedX, -proposedY, 3], immediate: true });
    }
    
    return memo;
  }, { pointerEvents: true, filterTaps: true });

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

  return (
    <animated.group 
      position={pos} 
      {...bindEvents} 
      onPointerDown={handlePointerDown} 
      onPointerUp={handlePointerUp}
      onPointerOver={() => setHovered(true)} 
      onPointerOut={() => setHovered(false)}
    >
      
      {/* Floor */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[width, height]} />
        <animated.meshBasicMaterial color={floorColor} side={THREE.DoubleSide} />
      </mesh>

      {/* Room Name */}
      <animated.group position={[0, 0, 0.05]}>
        <Text
          fontSize={Math.min(0.7, (width * 0.9) / Math.max(1, name.length * 0.45))}
          maxWidth={width - 0.2}
          textAlign="center"
          color="#3f51b5" // Primary UI color
          anchorX="center"
          anchorY="middle"
        >
          {name}
        </Text>
      </animated.group>

      {/* Walls (Top, Bottom, Left, Right) - Dynamic with holes for doors */}
      {(() => {
        const renderWallSegments = (isVertical, fixedPos, startPos, endPos) => {
          let segments = [[startPos, endPos]];
          
          const doorsWithLocalCoords = allDoors.map(d => {
            if (d.room_id === room.id) {
              return { ...d, localX: d.x, localY: -d.y };
            } else {
              const otherRoom = allRooms.find(r => r.id === d.room_id);
              if (!otherRoom) return null;
              const absX = otherRoom.x + d.x;
              const absY = otherRoom.y + d.y;
              return { ...d, localX: absX - room.x, localY: -(absY - room.y) };
            }
          }).filter(Boolean);

          const cuttingDoors = doorsWithLocalCoords.filter(d => {
            if (isVertical) {
              if (Math.abs(d.localX - fixedPos) > 0.5) return false;
              if (d.localY + d.width/2 < startPos || d.localY - d.width/2 > endPos) return false;
              return true;
            } else {
              if (Math.abs(d.localY - fixedPos) > 0.5) return false;
              if (d.localX + d.width/2 < startPos || d.localX - d.width/2 > endPos) return false;
              return true;
            }
          });

          cuttingDoors.forEach(d => {
            const dCenter = isVertical ? d.localY : d.localX;
            const dHalf = d.width / 2;
            const cutStart = dCenter - dHalf;
            const cutEnd = dCenter + dHalf;
            
            const newSegments = [];
            segments.forEach(([segStart, segEnd]) => {
              if (cutEnd <= segStart || cutStart >= segEnd) {
                newSegments.push([segStart, segEnd]);
              } else {
                if (segStart < cutStart) newSegments.push([segStart, cutStart]);
                if (segEnd > cutEnd) newSegments.push([cutEnd, segEnd]);
              }
            });
            segments = newSegments;
          });

          return segments.map((seg, idx) => {
            const segLength = seg[1] - seg[0];
            const segCenter = (seg[0] + seg[1]) / 2;
            
            if (isVertical) {
              return (
                <mesh key={`${isVertical ? 'v' : 'h'}-${fixedPos}-${idx}`} position={[fixedPos, segCenter, WALL_HEIGHT / 2]}>
                  <boxGeometry args={[WALL_THICKNESS, segLength, WALL_HEIGHT]} />
                  <animated.meshStandardMaterial color={wallColor} />
                </mesh>
              );
            } else {
              return (
                <mesh key={`${isVertical ? 'v' : 'h'}-${fixedPos}-${idx}`} position={[segCenter, fixedPos, WALL_HEIGHT / 2]}>
                  <boxGeometry args={[segLength, WALL_THICKNESS, WALL_HEIGHT]} />
                  <animated.meshStandardMaterial color={wallColor} />
                </mesh>
              );
            }
          });
        };

        return (
          <>
            {renderWallSegments(false, height / 2 - WALL_THICKNESS / 2, -width / 2, width / 2)} {/* Top */}
            {renderWallSegments(false, -height / 2 + WALL_THICKNESS / 2, -width / 2, width / 2)} {/* Bottom */}
            {renderWallSegments(true, -width / 2 + WALL_THICKNESS / 2, -height / 2 + WALL_THICKNESS, height / 2 - WALL_THICKNESS)} {/* Left */}
            {renderWallSegments(true, width / 2 - WALL_THICKNESS / 2, -height / 2 + WALL_THICKNESS, height / 2 - WALL_THICKNESS)} {/* Right */}
          </>
        );
      })()}

      {/* Render children (Sensors, Doors) inside the room's group */}
      {children}
    </animated.group>
  );
}
