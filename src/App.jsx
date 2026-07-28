import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import RoomModal from './components/room/RoomModal';
import StationGenerator from './components/generator/StationGenerator';
import CandidateView from './components/candidate/CandidateView';
import ExaminerView from './components/examiner/ExaminerView';
import ExamReportView from './components/report/ExamReportView';
import { INITIAL_STATIONS } from './store/mockData';
import { syncEngine, SYNC_ACTIONS } from './services/syncService';

export default function App() {
  // Navigation & Role State
  const [currentView, setCurrentView] = useState('generator'); // 'generator' | 'candidate' | 'examiner' | 'report'
  const [currentRole, setCurrentRole] = useState('EXAMINER_1'); // 'CANDIDATE' | 'EXAMINER_1' | 'EXAMINER_2' | 'EXAMINER_3'

  // Room State
  const [roomId, setRoomId] = useState('888999');
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);

  // Stations State
  const [stations, setStations] = useState(INITIAL_STATIONS);
  const [activeStation, setActiveStation] = useState(INITIAL_STATIONS[0]);

  // Exam Real-time States
  const [timerState, setTimerState] = useState({
    state: 'PAUSED', // 'RUNNING' | 'PAUSED'
    secondsLeft: INITIAL_STATIONS[0].timing?.examSeconds || 480,
    phase: 'EXAM'   // 'READING' | 'EXAM' | 'FEEDBACK'
  });

  const [activeCuePrompt, setActiveCuePrompt] = useState(null);
  const [examinerScores, setExaminerScores] = useState({});
  const [cueLog, setCueLog] = useState([]);

  // Read Room ID from URL query param if present (?room=123456)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setRoomId(roomParam);
    }
  }, []);

  // Update timer seconds when activeStation changes
  useEffect(() => {
    if (activeStation?.timing?.examSeconds) {
      setTimerState(prev => ({
        ...prev,
        secondsLeft: activeStation.timing.examSeconds,
        state: 'PAUSED'
      }));
    }
  }, [activeStation]);

  // Synchronize Timer across tabs/devices
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((msg) => {
      if (msg.roomId && msg.roomId !== roomId) return;

      if (msg.type === SYNC_ACTIONS.TIMER_CONTROL) {
        setTimerState(prev => ({
          ...prev,
          ...msg.payload
        }));
      } else if (msg.type === SYNC_ACTIONS.EXAMINER_SCORE_UPDATE) {
        const { examinerId, scores, totalScore } = msg.payload;
        setExaminerScores(prev => ({
          ...prev,
          [examinerId]: {
            ...(prev[examinerId] || {}),
            scores,
            totalScore
          }
        }));
      }
    });

    return unsubscribe;
  }, [roomId]);

  // Active Timer Countdown Interval
  useEffect(() => {
    let interval = null;
    if (timerState.state === 'RUNNING') {
      interval = setInterval(() => {
        setTimerState(prev => {
          if (prev.secondsLeft <= 1) {
            clearInterval(interval);
            return { ...prev, secondsLeft: 0, state: 'PAUSED' };
          }
          return { ...prev, secondsLeft: prev.secondsLeft - 1 };
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerState.state]);

  // Handlers
  const handleStartExamFromGenerator = () => {
    setTimerState({
      state: 'PAUSED',
      secondsLeft: activeStation.timing?.examSeconds || 480,
      phase: 'EXAM'
    });
    setExaminerScores({});
    setCueLog([]);
    setActiveCuePrompt(null);
    setCurrentView('examiner');
  };

  const handleCompleteExam = () => {
    setCurrentView('report');
  };

  const handleResetExam = () => {
    setTimerState({
      state: 'PAUSED',
      secondsLeft: activeStation.timing?.examSeconds || 480,
      phase: 'EXAM'
    });
    setExaminerScores({});
    setCueLog([]);
    setActiveCuePrompt(null);
    setCurrentView('generator');
  };

  return (
    <div className="app-container">
      {/* Top Header Navbar */}
      <Navbar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
        roomId={roomId}
        onOpenRoomModal={() => setIsRoomModalOpen(true)}
        activeStation={activeStation}
      />

      {/* Main View Container */}
      <main className="main-content">
        {currentView === 'generator' && (
          <StationGenerator 
            stations={stations}
            setStations={setStations}
            activeStation={activeStation}
            setActiveStation={setActiveStation}
            onStartExam={handleStartExamFromGenerator}
          />
        )}

        {currentView === 'candidate' && (
          <CandidateView 
            station={activeStation}
            timerState={timerState}
            activeCuePrompt={activeCuePrompt}
            setActiveCuePrompt={setActiveCuePrompt}
            roomId={roomId}
          />
        )}

        {currentView === 'examiner' && (
          <ExaminerView 
            station={activeStation}
            timerState={timerState}
            setTimerState={setTimerState}
            currentRole={currentRole}
            setCurrentRole={setCurrentRole}
            examinerScores={examinerScores}
            setExaminerScores={setExaminerScores}
            cueLog={cueLog}
            setCueLog={setCueLog}
            roomId={roomId}
            onCompleteExam={handleCompleteExam}
          />
        )}

        {currentView === 'report' && (
          <ExamReportView 
            station={activeStation}
            examinerScores={examinerScores}
            cueLog={cueLog}
            onResetExam={handleResetExam}
          />
        )}
      </main>

      {/* Room QR Code Modal */}
      <RoomModal 
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        roomId={roomId}
        setRoomId={setRoomId}
        currentRole={currentRole}
        setCurrentRole={setCurrentRole}
      />
    </div>
  );
}
