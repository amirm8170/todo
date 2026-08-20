import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

type PhoneContextValue = {
  phoneRef: RefObject<HTMLDivElement | null>;
  overlayEl: HTMLDivElement | null;
};

const PhoneContext = createContext<PhoneContextValue | null>(null);

export function usePhone() {
  const context = useContext(PhoneContext);
  if (!context) {
    throw new Error('usePhone must be used inside PhoneFrame');
  }
  return context;
}

export function PhoneFrame({ children }: { children: ReactNode }) {
  const phoneRef = useRef<HTMLDivElement>(null);
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null);

  return (
    <PhoneContext.Provider value={{ phoneRef, overlayEl }}>
      <div className="stage">
        <div className="phone" ref={phoneRef}>
          {children}
          <div className="phone-overlay" ref={setOverlayEl} />
        </div>
      </div>
    </PhoneContext.Provider>
  );
}
