/*
* Tencent is pleased to support the open source community by making WeUI.js available.
*
* Copyright (C) 2017 THL A29 Limited, a Tencent company. All rights reserved.
*
* Licensed under the MIT License (the "License"); you may not use this file except in compliance
* with the License. You may obtain a copy of the License at
*
*       http://opensource.org/licenses/MIT
*
* Unless required by applicable law or agreed to in writing, software distributed under the License is
* distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
* either express or implied. See the License for the specific language governing permissions and
* limitations under the License.
*/

import $ from '../util/util';

/**
 * set transition
 * @param $target
 * @param time
 */
const setTransition = ($target, time) => {
    return $target.css({
        '-webkit-transition': `all ${time}s`,
        'transition': `all ${time}s`
    });
};


/**
 * set translate
 */
const setTranslate = ($target, diff) => {
    return $target.css({
        '-webkit-transform': `translate3d(0, ${diff}px, 0)`,
        'transform': `translate3d(0, ${diff}px, 0)`
    });
};

/**
 * @desc get index of middle item
 * @param items
 * @returns {number}
 */
const getDefaultIndex = (items) => {
    let current = Math.floor(items.length / 2);
    let count = 0;
    while (!!items[current] && items[current].disabled) {
        current = ++current % items.length;
        count++;

        if (count > items.length) {
            throw new Error('No selectable item.');
        }
    }

    return current;
};

const getDefaultTranslate = (offset, rowHeight, items) => {
    const currentIndex = getDefaultIndex(items);

    return (offset - currentIndex) * rowHeight;
};

/**
 * get max translate
 * @param offset
 * @param rowHeight
 * @returns {number}
 */
const getMax = (offset, rowHeight) => {
    return offset * rowHeight;
};

/**
 * get min translate
 * @param offset
 * @param rowHeight
 * @param length
 * @returns {number}
 */
const getMin = (offset, rowHeight, length) => {
    return -(rowHeight * (length - offset - 1));
};

/**
 * 当前 Picker 组件的 translateY 值
 */
let curTranslateY;

$.fn.scroll = function (options) {
    const $this = $(this).offAll();
    const $content = $this.find('.weui-picker__content');

    const itemHeight = Math.round($content.find('.weui-picker__item')[0].clientHeight);
    const defaults = $.extend({
        items: [],                                  // 数据
        offset: 2,                                  // 列表初始化时的偏移量（列表初始化时，选项是聚焦在中间的，通过offset强制往上挪3项，以达到初始选项是为顶部的那项）
        rowHeight: itemHeight,                      // 列表每一行的高度
        onChange: $.noop,                           // onChange回调
        onScroll: $.noop,                           // onScroll回调
        temp: null,                                 // translate的缓存
        bodyHeight: 5 * itemHeight                  // picker的高度，用于辅助点击滚动的计算
    }, options);
    const items = defaults.items.map((item) => {
        return `<div role="option" title="按住上下可调" tabindex="0" class="weui-picker__item${item.disabled ? ' weui-picker__item_disabled' : ''}">${typeof item == 'object' ? item.label : item}</div>`;
    }).join('');
    $this[0].parentElement.style.height = defaults.bodyHeight + 'px';
    $content.html(items);

    let $scrollable = $content;          // 可滚动的元素
    let start;                                                  // 保存开始按下的位置
    let end;                                                    // 保存结束时的位置
    let startTime;                                              // 开始触摸的时间
    let lastIndex = null;                                       // 记录上一次触发onChange时的索引值
    const points = [];                                          // 记录移动点

    // 首次触发选中事件
    // 如果有缓存的选项，则用缓存的选项，否则使用中间值。
    if(defaults.temp !== null && defaults.temp < defaults.items.length) {
        const index = defaults.temp;
        defaults.onChange.call(this, defaults.items[index], index);
        curTranslateY = (defaults.offset - index) * defaults.rowHeight;
    }else{
        const index = getDefaultIndex(defaults.items);
        defaults.onChange.call(this, defaults.items[index], index);
        curTranslateY = getDefaultTranslate(defaults.offset, defaults.rowHeight, defaults.items);
    }
    setTranslate($scrollable, curTranslateY);

    function stop(diff) {
        curTranslateY += diff;

        // 移动到最接近的那一行
        curTranslateY = Math.round(curTranslateY / defaults.rowHeight) * defaults.rowHeight;
        const max = getMax(defaults.offset, defaults.rowHeight);
        const min = getMin(defaults.offset, defaults.rowHeight, defaults.items.length);
        // 不要超过最大值或者最小值
        if (curTranslateY > max) {
            curTranslateY = max;
        }
        if (curTranslateY < min) {
            curTranslateY = min;
        }

        // 如果是 disabled 的就跳过
        let index = defaults.offset - curTranslateY / defaults.rowHeight;
        while (!!defaults.items[index] && defaults.items[index].disabled) {
            diff > 0 ? ++index : --index;
        }
        curTranslateY = (defaults.offset - index) * defaults.rowHeight;
        setTransition($scrollable, .3);
        setTranslate($scrollable, curTranslateY);

        // 触发选择事件
        if (index !== lastIndex) {
            defaults.onScroll.call(this, defaults.items[index], index);
            defaults.onChange.call(this, defaults.items[index], index);
        }
        lastIndex = null; // 重置
    }

    function _start(pageY){
        start = pageY;
        startTime = +new Date();
    }
    function _move(pageY){
        end = pageY;
        let newTranslate = curTranslateY + (end - start);

        setTransition($scrollable, 0);
        setTranslate($scrollable, newTranslate);
        startTime = +new Date();
        points.push({time: startTime, y: end});
        if (points.length > 40) {
            points.shift();
        }

        // 移动到最接近的那一行
        newTranslate = Math.round(newTranslate / defaults.rowHeight) * defaults.rowHeight;

        // 超过最大值或者最小值时不响应 onChange
        const max = getMax(defaults.offset, defaults.rowHeight);
        const min = getMin(defaults.offset, defaults.rowHeight, defaults.items.length);
        if (newTranslate > max || newTranslate < min) return;

        // 如果是 disabled 也不响应 onChange
        const index = defaults.offset - newTranslate / defaults.rowHeight;
        if (!!defaults.items[index] && defaults.items[index].disabled) return;

        if (index !== lastIndex) { // 如果和上次的索引值不一样，则触发 onChange 事件，并更新上次的索引值
            defaults.onScroll.call(this, defaults.items[index], index);
        }
    }
    function _end(pageY){
        if(!start) return;

        /**
         * 思路:
         * 0. touchstart 记录按下的点和时间
         * 1. touchmove 移动时记录前 40个经过的点和时间
         * 2. touchend 松开手时, 记录该点和时间. 如果松开手时的时间, 距离上一次 move时的时间超过 100ms, 那么认为停止了, 不执行惯性滑动
         *    如果间隔时间在 100ms 内, 查找 100ms 内最近的那个点, 和松开手时的那个点, 计算距离和时间差, 算出速度
         *    速度乘以惯性滑动的时间, 例如 300ms, 计算出应该滑动的距离
         */
        const endTime = new Date().getTime();
        const relativeY = $this[0].getBoundingClientRect().top  + defaults.bodyHeight / 2;
        end = pageY;

        // 如果上次时间距离松开手的时间超过 100ms, 则停止了, 没有惯性滑动
        if (endTime - startTime > 100) {
            //如果end和start相差小于10，则视为
            if (Math.abs(end - start) > 10) {
                stop(end - start);
            } else {
                stop(relativeY - end);
            }
        } else {
            if (Math.abs(end - start) > 10) {
                const endPos = points.length - 1;
                let startPos = endPos;
                for (let i = endPos; i > 0 && startTime - points[i].time < 100; i--) {
                    startPos = i;
                }

                if (startPos !== endPos) {
                    const ep = points[endPos];
                    const sp = points[startPos];
                    const t = ep.time - sp.time;
                    const s = ep.y - sp.y;
                    const v = s / t; // 出手时的速度
                    const diff = v * 150 + (end - start); // 滑行 150ms,这里直接影响“灵敏度”
                    stop(diff);
                }
                else {
                    stop(0);
                }
            } else {
                stop(relativeY - end);
            }
        }

        start = null;
    }

    $this
    .on('touchstart', function (evt) {
        _start(evt.changedTouches[0].pageY);
    })
    .on('touchmove', function (evt) {
        _move(evt.changedTouches[0].pageY);
        evt.preventDefault();
    })
    .on('touchend', function (evt) {
        _end(evt.changedTouches[0].pageY);
    });

    $this
    .on('mousedown', function(evt){
        _start(evt.pageY);
        evt.stopPropagation();
        evt.preventDefault();
    })
    .on('mousemove', function(evt){
        if(!start) return;

        _move(evt.pageY);
        evt.stopPropagation();
        evt.preventDefault();
    })
    .on('mouseup mouseleave', function(evt){
        _end(evt.pageY);
        evt.stopPropagation();
        evt.preventDefault();
    });
};

const operTranslateY = (function () {
    const reg = /(.*\(([0-9],\s{1,1}){5})(([+-]?)[0-9\.]*)\)/gm;

    return {
        get(elem) {
            reg.lastIndex = 0;

            const matrix = $.getStyle(elem, 'transform');
            const groups = reg.exec(matrix);

            if (groups != null) {
                return Number.parseFloat(groups[3]);
            } else {
                return 0;
            }
        },
        set(elem, y) {
            reg.lastIndex = 0;

            const matrix = $.getStyle(elem, 'transform');

            elem.style.transform = matrix.replace(reg, `$1${y})`);
        }
    };
})();

function wheelHandle({ e, itemHeight: rowHeight, $content, defaults }) {
    let translateY = curTranslateY || operTranslateY.get($content[0]);       // 当前 Y 轴偏移量

    if (Math.abs(e.deltaY) > 1) {
        let directionEnum = ['down', 'up'];
        let direction = e.deltaY > 0 ? directionEnum[0] : directionEnum[1]; // 当前滚动的方向

        const max = getMax(defaults.offset, defaults.rowHeight);
        const min = getMin(defaults.offset, defaults.rowHeight, defaults.items.length);

        if (direction === directionEnum[0]) {
            // 向下滚动
            translateY -= rowHeight;
        }
        else if (direction === directionEnum[1]) {
            // 向上滚动
            translateY += rowHeight;
        }

        // 取最近的一行
        translateY = Math.round(translateY / defaults.rowHeight) * defaults.rowHeight;

        // 不要超过最大值或者最小值
        if (translateY > max) {
            translateY = max;
        }
        if (translateY < min) {
            translateY = min;
        }

        // 如果是 disabled 的就跳过
        let index = defaults.offset - translateY / defaults.rowHeight;
        while (!!defaults.items[index] && defaults.items[index].disabled) {
            direction === directionEnum[0] ? ++index : --index;
        }
        translateY = (defaults.offset - index) * defaults.rowHeight;

        curTranslateY = translateY;
        operTranslateY.set($content[0], translateY);


    }
}

// 处理滚轮事件
// 注意：wheel 事件跟 scroll 事件是有区别的
// 详情：https://developer.mozilla.org/zh-CN/docs/Web/API/WheelEvent
$.fn.wheel = function (options) {
    const $this = this;
    const $content = $this.find('.weui-picker__content');
    const rowHeight = Math.round($content.find('.weui-picker__item')[0].clientHeight);

    const defaults = $.extend({
        items: [],                                          // 选项数据
        offset: 2,                                          // 列表初始化时的偏移量（列表初始化时，选项是聚焦在中间的，通过offset强制往上挪3项，以达到初始选项是为顶部的那项）
        // onScroll: $.noop,                                   // onScroll回调
        rowHeight: rowHeight,                              // 列表每一行的高度
        bodyHeight: 5 * rowHeight,                         // picker的高度，用于辅助点击滚动的计算
        onChange: $.noop,                                   // onChange回调
        transiting: false,                                  // 是否处于滚动过渡中状态
    }, options);

    // 设置过渡
    setTransition($content, .3);
    // 设置 Y
    operTranslateY.set($content[0], curTranslateY);

    // 监听滚轮事件
    $this.on('wheel', function (e) {
        defaults.transiting = true;
        wheelHandle({ e, itemHeight: rowHeight, defaults, $this, $content });
    });

    // 监听过渡结束事件
    $content.on('transitionend', function () {

        if (!defaults.transiting) return ;
        defaults.transiting = false;

        let item, index;

        defaults.items.reduce((sum, it, idx) => {
            if (sum === curTranslateY) {
                item = it;
                index = idx;
            }
            sum -= defaults.rowHeight;
            return sum;
        }, 96);

        defaults.onChange(this, item, index);
    });
};
