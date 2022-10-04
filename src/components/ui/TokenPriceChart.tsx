import React, { memo, useMemo } from '../../lib/teact/teact';

interface OwnProps {
  isChartSmooth?: boolean;
  width: number;
  height: number;
  prices: number[];
  className?: string;
}

const PATH_SMOOTHING = 0.0001;

function TokenPriceChart({
  width,
  height,
  prices,
  isChartSmooth,
  className,
}: OwnProps) {
  const boundingPoints = useMemo(() => {
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    return {
      width: prices.length - 1,
      height: max - min,
      min,
    };
  }, [prices]);

  const points = useMemo(() => {
    const scaleX = width / boundingPoints.width;
    const scaleY = height / boundingPoints.height;

    return prices.map((y, i) => ({ x: i * scaleX + 3, y: (y - boundingPoints.min) * scaleY + 3 }));
  }, [boundingPoints.height, boundingPoints.min, boundingPoints.width, height, width, prices]);

  function getBasisPoint(i: number) {
    const indexesCount = points.length - 1;
    const index = i < 0 ? 0 : i > indexesCount ? indexesCount : i;
    const point = points[index];
    const ratio = 1 - PATH_SMOOTHING;
    const tangent = index / indexesCount;
    const firstPoint = points[0];
    const distance = {
      x: points[indexesCount].x - firstPoint.x,
      y: points[indexesCount].y - firstPoint.y,
    };

    return {
      x: ratio * point.x + (1 - ratio) * (firstPoint.x + tangent * distance.x),
      y: ratio * point.y + (1 - ratio) * (firstPoint.y + tangent * distance.y),
    };
  }

  function getCurvePath(i: number) {
    const pCurrent = getBasisPoint(i);
    const pMinus1 = getBasisPoint(i - 1);
    const pMinus2 = getBasisPoint(i - 2);

    const x1 = (2 * pMinus2.x + pMinus1.x) / 3;
    const y1 = (2 * pMinus2.y + pMinus1.y) / 3;
    const x2 = (pMinus2.x + 2 * pMinus1.x) / 3;
    const y2 = (pMinus2.y + 2 * pMinus1.y) / 3;
    const x3 = (pMinus2.x + 4 * pMinus1.x + pCurrent.x) / 6;
    const y3 = (pMinus2.y + 4 * pMinus1.y + pCurrent.y) / 6;

    return `C ${x1} ${y1} ${x2} ${y2} ${x3} ${y3}`;
  }

  function getLinePath(point: { x: number; y: number }) {
    return `L ${point.x} ${point.y}`;
  }

  function getPath() {
    let d = points.reduce((acc, point, i) => {
      const partialPath = isChartSmooth
        ? getCurvePath(i)
        : getLinePath(point);
      return i === 0
        ? `M ${i} ${point.y} `
        : `${acc} ${partialPath} `;
    }, '');

    if (isChartSmooth) {
      d += getCurvePath(points.length);
      d += getLinePath(points[points.length - 1]);
    }

    return d;
  }

  function renderSvg() {
    const lastPoint = points[points.length - 1];

    const svg = `<svg viewBox="0 0 ${width + 6} ${height + 6}" height="${height + 6}" width="${width + 6}"
        xmlns="http://www.w3.org/2000/svg" style="transform: scale(1,-1)">
        <g fill="none" stroke="white">
          <path stroke-linejoin="round" stroke-width="1.5" d="${getPath()}" style="stroke-linecap: round" />
          <circle r="2.5" fill="white" cx="${lastPoint.x}" cy="${lastPoint.y}" />
        </g>
      </svg>`;

    return `data:image/svg+xml;utf8,${(svg)}`;
  }

  return (
    <img
      src={renderSvg()}
      alt="Currency History"
      className={className}
    />
  );
}

export default memo(TokenPriceChart);
