import { useEditorStore } from '../store/useEditorStore';

export const VideoComposition = () => {
  const { nodes } = useEditorStore();
  


  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#000' }}>
      {/* Render all elements at current time */}
      {nodes.map((el) => (
        <div
          key={el.id}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: el.boundingSize?.[0] ?? 200,
            height: el.boundingSize?.[1] ?? 60,
            transform: `translate(${el.x ?? 0}px, ${el.y ?? 0}px) rotate(${el.rotation ?? 0}deg) scale(${el.scaleX ?? 1}, ${el.scaleY ?? 1})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 24,
            zIndex: el.zIndex ?? 1,
            overflow: 'visible',
          }}
        >
          {el.content}
        </div>
      ))}
    </div>
  );
};
