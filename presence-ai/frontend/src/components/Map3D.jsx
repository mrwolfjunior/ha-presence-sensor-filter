import React, { Suspense, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { MapControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import Room3D from './Room3D';
import Sensor3D from './Sensor3D';
import DoorWindow3D from './DoorWindow3D';

function DashedGrid() {
  const size = 100;
  const geometry = React.useMemo(() => {
    const pts = [];
    for (let i = -size; i <= size; i++) {
      pts.push(new THREE.Vector3(i, -size, -0.1), new THREE.Vector3(i, size, -0.1));
      pts.push(new THREE.Vector3(-size, i, -0.1), new THREE.Vector3(size, i, -0.1));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return geo;
  }, []);

  return (
    <lineSegments geometry={geometry} onUpdate={line => line.computeLineDistances()} raycast={() => null}>
      <lineDashedMaterial color="#cccccc" dashSize={0.2} gapSize={0.2} scale={1} />
    </lineSegments>
  );
}

export default function Map3D({ 
  rooms = [], sensors = [], doors = [], 
  selectedElement, onSelectElement,
  updateRoom, updateSensorConfig, updateDoor, deleteRoom, deleteDoor,
  onCameraChange
}) {
  const controlsRef = React.useRef();

  const setControlsEnabled = React.useCallback((enabled) => {
    if (controlsRef.current) {
      controlsRef.current.enabled = enabled;
    }
  }, []);

  React.useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (controlsRef.current && !controlsRef.current.enabled) {
        controlsRef.current.enabled = true;
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#f5f5f5' }}>
      <Canvas shadows orthographic camera={{ position: [0, 0, 50], zoom: 50, up: [0, 1, 0] }} onPointerMissed={() => onSelectElement(null)}>
        <MapControls 
          ref={controlsRef}
          makeDefault 
          screenSpacePanning={true} 
          enableRotate={false} 
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN, 
            MIDDLE: THREE.MOUSE.PAN,
            RIGHT: THREE.MOUSE.PAN
          }}
          onChange={(e) => onCameraChange && onCameraChange(e.target.object.zoom)}
        />
        <ambientLight intensity={0.7} />
        <directionalLight 
          position={[10, -10, 20]} 
          intensity={0.5} 
        />
        
        <DashedGrid />

        <Suspense fallback={null}>
          {/* Rooms */}
          {rooms.map(room => {
            const roomSensors = sensors.filter(s => s.room_id === room.id);
            const roomDoors = doors.filter(d => d.room_id === room.id);
            
            return (
              <Room3D 
                key={room.id} 
                room={room} 
                allRooms={rooms}
                allDoors={doors}
                isSelected={selectedElement?.id === room.id}
                onSelect={() => onSelectElement({ type: 'room', id: room.id })}
                onUpdate={updateRoom} onDelete={deleteRoom}
                setControlsEnabled={setControlsEnabled}
              >
                {/* Sensors for this room */}
                {roomSensors.map(sensor => (
                  <Sensor3D 
                    key={sensor.sensor_id} sensor={sensor} room={room} allRooms={rooms}
                    isSelected={selectedElement?.id === sensor.sensor_id}
                    onSelect={() => onSelectElement({ type: 'sensor', id: sensor.sensor_id })}
                    onUpdate={updateSensorConfig}
                    setControlsEnabled={setControlsEnabled}
                  />
                ))}

                {/* Doors and Windows for this room */}
                {roomDoors.map(door => (
                  <DoorWindow3D 
                    key={door.id} item={door} 
                    allRooms={rooms}
                    allDoors={doors}
                    isSelected={selectedElement?.id === door.id}
                    onSelect={() => onSelectElement({ type: door.type, id: door.id })}
                    onUpdate={updateDoor} onDelete={deleteDoor}
                    setControlsEnabled={setControlsEnabled}
                  />
                ))}
              </Room3D>
            );
          })}
        </Suspense>
      </Canvas>
    </div>
  );
}
